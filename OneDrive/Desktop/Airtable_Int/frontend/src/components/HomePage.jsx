import React, { useState, useEffect } from "react";
import axios from "axios";
import { Link } from "react-router-dom";

const HomePage = () => {
  const [forms, setForms] = useState([]);
  const userId = "test_user_123"; // This would be dynamic in a real app

  useEffect(() => {
    // Fetch existing form configurations for the user
    axios
      .get(`/api/form-configs/${userId}`)
      .then((res) => {
        setForms(res.data);
      })
      .catch((err) => {
        console.error("Could not fetch existing forms:", err);
        // Fail silently on the homepage if forms can't be fetched
      });
  }, [userId]);

  return (
    <div className="max-w-2xl mx-auto p-8 space-y-6">
      <h1 className="text-3xl font-light text-gray-900">
        Airtable Form Builder
      </h1>
      <p className="text-gray-600 leading-relaxed">
        This application allows you to connect to your Airtable account, build a
        web form based on one of your tables, and submit data directly to it.
      </p>

      <h3 className="text-xl font-medium text-gray-800 mt-8">Get Started</h3>
      <p className="text-gray-600 leading-relaxed">
        Connect your Airtable account or go directly to the builder if you're
        already authenticated.
      </p>
      <div className="flex items-center space-x-4">
        <a
          href={`/auth/airtable?user_id=${userId}`}
          className="inline-block px-6 py-3 bg-gray-900 text-white font-medium rounded-lg hover:bg-gray-800 transition-colors"
        >
          Connect to Airtable
        </a>
        <Link
          to={`/builder?user_id=${userId}`}
          className="inline-block px-6 py-3 bg-white text-gray-800 font-medium rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
        >
          Go to Builder
        </Link>
        <Link
          to={`/dashboard?user_id=${userId}`}
          className="button"
          style={{ backgroundColor: "#17a2b8" }}
        >
          Go to Your Dashboard
        </Link>
      </div>

      {/* This new section will only appear if the user has saved forms */}
      {forms.length > 0 && (
        <div className="mt-10">
          <h3 className="text-xl font-medium text-gray-800">
            Your Saved Forms
          </h3>
          <ul className="mt-4 space-y-2 list-disc list-inside text-gray-700">
            {forms.map((form) => (
              <li key={`${form.baseId}-${form.tableId}`}>
                <Link
                  to={`/form/${userId}/${form.baseId}/${form.tableId}`}
                  className="text-blue-600 hover:text-blue-800 underline"
                >
                  {form.tableName || `Form for table: ${form.tableId}`}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default HomePage;
