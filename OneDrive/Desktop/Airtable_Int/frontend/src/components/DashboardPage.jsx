"use client"

import { useState, useEffect } from "react"
import axios from "axios"
import { Link, useSearchParams } from "react-router-dom"
const backend = import.meta.env.VITE_BACKEND_LINK || import.meta.env.VITE_API_URL || "http://localhost:4000"
const DashboardPage = () => {
  const [searchParams] = useSearchParams()
  // In a real app, you'd get the userId from a login context
  const userId = searchParams.get("user_id") || "test_user_123"

  const [forms, setForms] = useState([])
  const [status, setStatus] = useState({ message: "", type: "" })

  useEffect(() => {
    if (userId) {
      setStatus({ message: "Loading forms...", type: "loading" })
      axios
        .get(`${backend}/api/form-configs/${userId}`)
        .then((res) => {
          setForms(res.data)
          setStatus({ message: "", type: "" }) // Clear status on success
        })
        .catch((err) => {
          setStatus({ message: "Could not fetch your saved forms.", type: "error" })
        })
    }
  }, [userId, backend])

  return (
    <div className="container">
      <h1>Your Dashboard</h1>
      <p>Here is a list of all the forms you have created. Click on any form to view it.</p>

      <div style={{ marginTop: "2rem" }}>
        <Link to={`/builder?user_id=${userId}`} className="button">
          + Create a New Form
        </Link>
      </div>

      <div style={{ marginTop: "2rem" }}>
        {status.message && <p className={`status ${status.type}`}>{status.message}</p>}

        {forms.length > 0 ? (
          <ul style={{ listStyle: "none", padding: 0 }}>
            {forms.map((form) => (
              <li
                key={`${form.baseId}-${form.tableId}`}
                style={{ border: "1px solid #eee", padding: "1rem", marginBottom: "1rem", borderRadius: "5px" }}
              >
                <Link
                  to={`/form/${userId}/${form.baseId}/${form.tableId}`}
                  style={{ textDecoration: "none", color: "#333" }}
                >
                  <strong style={{ fontSize: "1.2rem", color: "#007bff" }}>
                    {form.tableName || `Form for ${form.tableId}`}
                  </strong>
                  <p style={{ fontSize: "0.9rem", color: "#6c757d", margin: "0.5rem 0 0 0" }}>Base ID: {form.baseId}</p>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          !status.message && <p>You haven't created any forms yet.</p>
        )}
      </div>
    </div>
  )
}

export default DashboardPage
