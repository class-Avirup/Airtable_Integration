import crypto from 'crypto';
import { URL } from 'url';
import axios from 'axios';
import qs from 'qs';
import express from 'express';
import bodyParser from 'body-parser';
import { MongoClient } from 'mongodb';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(cors());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

let db;
const mongoUrl = process.env.MONGO_URL;
const dbName = 'airtable_oauth';
const tokensCollection = 'tokens';
const formConfigsCollection = 'form_configs';

async function initializeDB() {
    try {
        const client = new MongoClient(mongoUrl);
        await client.connect();
        db = client.db(dbName);
        await db.collection(tokensCollection).createIndex({ user_id: 1 });
        await db.collection(formConfigsCollection).createIndex({ userId: 1 });
        await db.collection(formConfigsCollection).createIndex({ userId: 1, baseId: 1, tableId: 1 }, { unique: true });
        console.log('[INFO] MongoDB connected and indexes created.');
    } catch (error) {
        console.error('[FATAL] Failed to connect to MongoDB:', error);
        process.exit(1);
    }
}

const clientId = process.env.CLIENT_ID;
const clientSecret = process.env.CLIENT_SECRET;
const port = process.env.BACKEND_PORT || 8000;
const redirectUri = process.env.REDIRECT_URI;
const scope = process.env.SCOPE;
const airtableUrl = process.env.AIRTABLE_URL;
const frontendUrl = process.env.FRONTEND_URL;

const encodedCredentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
const authorizationHeader = `Basic ${encodedCredentials}`;
const authorizationCache = {};

async function storeTokens(userId, tokenData) {
    try {
        const tokenDoc = {
            user_id: userId,
            access_token: tokenData.access_token,
            refresh_token: tokenData.refresh_token,
            token_type: tokenData.token_type,
            scope: tokenData.scope,
            expires_in: tokenData.expires_in,
            created_at: new Date(),
            expires_at: new Date(Date.now() + (tokenData.expires_in * 1000))
        };
        await db.collection(tokensCollection).replaceOne({ user_id: userId }, tokenDoc, { upsert: true });
        return tokenDoc;
    } catch (error) {
        console.error('[ERROR] Error storing tokens:', error);
        throw error;
    }
}

async function getTokens(userId) {
    try {
        return await db.collection(tokensCollection).findOne({ user_id: userId });
    } catch (error) {
        console.error('[ERROR] Error retrieving tokens:', error);
        throw error;
    }
}

async function refreshTokenForUser(userId, refreshToken) {
    try {
        const headers = { 'Content-Type': 'application/x-www-form-urlencoded' };
        if (clientSecret) {
            headers.Authorization = authorizationHeader;
        }
        const response = await axios({
            method: 'POST',
            url: `${airtableUrl}/oauth2/v1/token`,
            headers,
            data: qs.stringify({
                client_id: clientId,
                grant_type: 'refresh_token',
                refresh_token: refreshToken,
            }),
        });
        return await storeTokens(userId, response.data);
    } catch (error) {
        console.error('[ERROR] Token refresh failed:', error.response?.data || error.message);
        return null;
    }
}

async function makeAirtableRequest(userId, method, endpoint, data = null) {
    let tokens = await getTokens(userId);
    if (!tokens) throw new Error('No tokens found for user');

    if (tokens.expires_at && new Date() >= new Date(tokens.expires_at)) {
        const refreshedTokens = await refreshTokenForUser(userId, tokens.refresh_token);
        if (!refreshedTokens) throw new Error('Failed to refresh expired token');
        tokens = refreshedTokens;
    }

    const config = {
        method,
        url: `https://api.airtable.com/v0${endpoint}`,
        headers: {
            'Authorization': `Bearer ${tokens.access_token}`,
            'Content-Type': 'application/json'
        }
    };
    if (data) config.data = data;

    try {
        const response = await axios(config);
        return response.data;
    } catch (error) {
        console.error('[ERROR] Airtable API request failed:', error.response?.data || error.message);
        throw error;
    }
}

app.get('/auth/airtable', (req, res) => {
    const { user_id } = req.query;
    if (!user_id) return res.status(400).json({ error: 'user_id is required' });

    const state = crypto.randomBytes(100).toString('base64url');
    const codeVerifier = crypto.randomBytes(96).toString('base64url');
    const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

    authorizationCache[state] = { codeVerifier, userId: user_id };

    const authorizationUrl = new URL(`${airtableUrl}/oauth2/v1/authorize`);
    authorizationUrl.searchParams.set('code_challenge', codeChallenge);
    authorizationUrl.searchParams.set('code_challenge_method', 'S256');
    authorizationUrl.searchParams.set('state', state);
    authorizationUrl.searchParams.set('client_id', clientId);
    authorizationUrl.searchParams.set('redirect_uri', redirectUri);
    authorizationUrl.searchParams.set('response_type', 'code');
    authorizationUrl.searchParams.set('scope', scope);

    res.redirect(authorizationUrl.toString());
});

app.get('/auth/callback', async (req, res) => {
    const { state, code, error: queryError, error_description } = req.query;
    const cached = authorizationCache[state];

    if (!cached) return res.status(400).json({ error: 'Invalid state parameter' });

    const { codeVerifier, userId } = cached;
    delete authorizationCache[state];

    if (queryError) {
        return res.status(400).redirect(`${frontendUrl}/?error=${encodeURIComponent(error_description)}`);
    }

    const headers = { 'Content-Type': 'application/x-www-form-urlencoded' };
    if (clientSecret) headers.Authorization = authorizationHeader;

    try {
        const response = await axios({
            method: 'POST',
            url: `${airtableUrl}/oauth2/v1/token`,
            headers,
            data: qs.stringify({
                client_id: clientId,
                code_verifier: codeVerifier,
                redirect_uri: redirectUri,
                code,
                grant_type: 'authorization_code',
            }),
        });

        await storeTokens(userId, response.data);
        res.redirect(`${frontendUrl}/builder?user_id=${userId}`);
    } catch (error) {
        console.error('[ERROR] Token exchange error:', error.response?.data || error.message);
        res.status(500).redirect(`${frontendUrl}/?error=token_exchange_failed`);
    }
});

app.get('/api/bases/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const data = await makeAirtableRequest(userId, 'get', '/meta/bases');
        res.json(data);
    } catch (err) {
        const status = err.response?.status || 500;
        res.status(status).json({ error: err.message });
    }
});

app.get('/api/tables/:userId/:baseId', async (req, res) => {
    try {
        const { userId, baseId } = req.params;
        const data = await makeAirtableRequest(userId, 'get', `/meta/bases/${baseId}/tables`);
        res.json(data);
    } catch (err) {
        const status = err.response?.status || 500;
        res.status(status).json({ error: err.message });
    }
});

app.get('/api/fields/:userId/:baseId/:tableId', async (req, res) => {
    try {
        const { userId, baseId, tableId } = req.params;
        const data = await makeAirtableRequest(userId, 'get', `/meta/bases/${baseId}/tables`);
        const table = data.tables.find(t => t.id === tableId);
        if (!table) return res.status(404).json({ error: 'Table not found' });
        res.json(table);
    } catch (err) {
        const status = err.response?.status || 500;
        res.status(status).json({ error: err.message });
    }
});

app.post('/api/form-config', async (req, res) => {
    try {
        const { userId, baseId, tableId, fields, tableName } = req.body;
        const formConfig = { userId, baseId, tableId, fields, tableName, updated_at: new Date() };
        await db.collection(formConfigsCollection).replaceOne({ userId, baseId, tableId }, formConfig, { upsert: true });
        res.json({ success: true, message: 'Configuration saved.' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to save configuration.' });
    }
});

app.get('/api/form-configs/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        // Find all configs for the user and only return the fields needed for the list
        const configs = await db.collection(formConfigsCollection)
            .find({ userId })
            .project({ tableName: 1, baseId: 1, tableId: 1 })
            .toArray();
        res.json(configs);
    } catch (err) {
        res.status(500).json({ error: 'Failed to retrieve form configurations.' });
    }
});

app.get('/api/form-config/:userId/:baseId/:tableId', async (req, res) => {
    try {
        const { userId, baseId, tableId } = req.params;
        const config = await db.collection(formConfigsCollection).findOne({ userId, baseId, tableId });
        if (!config) return res.status(404).json({ error: 'Configuration not found.' });
        res.json(config);
    } catch (err) {
        res.status(500).json({ error: 'Failed to retrieve configuration.' });
    }
});

app.post('/api/submit/:userId/:baseId/:tableId', async (req, res) => {
    try {
        const { userId, baseId, tableId } = req.params;
        const airtablePayload = { fields: req.body };
        const result = await makeAirtableRequest(userId, 'post', `/${baseId}/${tableId}`, airtablePayload);
        res.json({ success: true, record: result });
    } catch (err) {
        const status = err.response?.status || 500;
        res.status(status).json({ error: 'Failed to submit to Airtable.' });
    }
});

app.listen(port, async () => {
    await initializeDB();
    console.log(`[INFO] Backend server started on http://localhost:${port}`);
});