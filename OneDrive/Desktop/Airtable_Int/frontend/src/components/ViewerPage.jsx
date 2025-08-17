"use client";

import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { useParams } from "react-router-dom";

// This FormField component remains unchanged
const FormField = ({ field, value, onChange, error }) => {
  const { type, airtableFieldId, label, name, options } = field;
  const inputStyle = { border: error ? "1px solid red" : "1px solid #ccc" };

  const renderInput = () => {
    switch (type) {
      case "singleSelect":
        return (
          <select id={airtableFieldId} name={name} value={value || ""} onChange={onChange} style={inputStyle}>
            <option value="">Select an option</option>
            {options?.choices.map((choice) => (
              <option key={choice.id} value={choice.name}>
                {choice.name}
              </option>
            ))}
          </select>
        );
      case "checkbox":
        return (
            <input
              type="checkbox" id={airtableFieldId} name={name} checked={!!value}
              onChange={(e) => onChange({ target: { name, value: e.target.checked } })}
            />
        );
      case "multilineText":
        return <textarea id={airtableFieldId} name={name} value={value || ""} onChange={onChange} rows="4" style={inputStyle} />;
      default:
        return <input type="text" id={airtableFieldId} name={name} value={value || ""} onChange={onChange} style={inputStyle} />;
    }
  };

  return (
    <>
      {renderInput()}
      {error && <p style={{ color: "red", fontSize: "0.8rem", marginTop: "4px" }}>{error}</p>}
    </>
  );
};

const ViewerPage = () => {
  const { userId, baseId, tableId } = useParams();
  const [config, setConfig] = useState(null);
  const [formData, setFormData] = useState({});
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState({ message: "", type: "" });

  // ADDED: New state to manage the view mode ('form' or 'preview')
  const [viewMode, setViewMode] = useState('form');

  useEffect(() => {
    axios
      .get(`/api/form-config/${userId}/${baseId}/${tableId}`)
      .then((res) => {
        setConfig(res.data);
        const initialData = res.data.fields.reduce((acc, field) => {
          acc[field.name] = field.type === "checkbox" ? false : "";
          return acc;
        }, {});
        setFormData(initialData);
      })
      .catch((err) =>
        setStatus({ message: "Could not load form configuration.", type: "error" })
      );
  }, [userId, baseId, tableId]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  const isFieldVisible = useCallback(
    (field) => {
      if (!config || !field.conditional) return true;
      const controllerField = config.fields.find(
        (f) => f.airtableFieldId === field.conditional.showIfField
      );
      if (!controllerField) return true;
      const controllerValue = formData[controllerField.name];
      const expectedValue =
        field.conditional.equalsValue === "true"
          ? true
          : field.conditional.equalsValue === "false"
          ? false
          : field.conditional.equalsValue;
      return controllerValue === expectedValue;
    },
    [config, formData]
  );

  const validateForm = () => {
    const newErrors = {};
    config.fields.forEach((field) => {
      if (isFieldVisible(field) && field.isRequired) {
        const value = formData[field.name];
        if (!value && typeof value !== "boolean") {
          newErrors[field.name] = `${field.label} is required.`;
        }
      }
    });
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // The original handleSubmit logic is now here, triggered from the preview screen
  const handleConfirmSubmit = () => {
    const submissionData = Object.keys(formData).reduce((acc, key) => {
      const field = config.fields.find((f) => f.name === key);
      if (
        field &&
        isFieldVisible(field) &&
        (formData[key] || typeof formData[key] === "boolean")
      ) {
        acc[key] = formData[key];
      }
      return acc;
    }, {});

    axios
      .post(`/api/submit/${userId}/${baseId}/${tableId}`, submissionData)
      .then((res) => {
        setStatus({
          message: `Submission successful! Record ID: ${res.data.record.id}`,
          type: "success",
        });
        // Go back to the form view after successful submission
        setViewMode('form');
        // Reset form data state
        const initialData = config.fields.reduce((acc, field) => {
          acc[field.name] = field.type === "checkbox" ? false : "";
          return acc;
        }, {});
        setFormData(initialData);
      })
      .catch((err) =>
        setStatus({ message: "Error submitting form.", type: "error" })
      );
  };

  // This function now handles the "Preview" button click
  const handlePreview = (e) => {
    e.preventDefault();
    // Validate the form, and if it's valid, switch to preview mode
    if (validateForm()) {
      setViewMode('preview');
    }
  };

  if (status.type === "error" && !config) {
    return <div className="container"><h1>{status.message}</h1></div>;
  }

  if (!config) {
    return <div className="container"><h1>Loading form...</h1></div>;
  }

  // NEW: Conditionally render based on the viewMode state
  if (viewMode === 'preview') {
    return (
      <div className="container">
        <h1>Preview Your Answers</h1>
        <div className="preview-list">
          {config.fields
            .filter(field => isFieldVisible(field) && (formData[field.name] || typeof formData[field.name] === 'boolean'))
            .map(field => (
              <div key={field.airtableFieldId} className="preview-item">
                <strong>{field.label}:</strong>
                <p>{String(formData[field.name])}</p>
              </div>
            ))}
        </div>
        <div className="button-group" style={{ marginTop: '20px' }}>
          <button onClick={() => setViewMode('form')} style={{ marginRight: '10px', backgroundColor: '#6c757d' }}>Edit</button>
          <button onClick={handleConfirmSubmit}>Confirm & Submit</button>
        </div>
      </div>
    );
  }

  // The original form view
  return (
    <div className="container">
      <h1>{config.tableName || "Airtable Form"}</h1>
      <form onSubmit={handlePreview} noValidate>
        {config.fields.map(
          (field) =>
            isFieldVisible(field) && (
              <div className="form-field" key={field.airtableFieldId}>
                <label htmlFor={field.airtableFieldId}>
                  {field.label}
                  {field.isRequired && <span style={{ color: "red" }}>*</span>}
                </label>
                <FormField
                  field={field}
                  value={formData[field.name]}
                  onChange={handleInputChange}
                  error={errors[field.name]}
                />
              </div>
            )
        )}
        {/* MODIFIED: Button now triggers preview, not direct submission */}
        <button type="submit">Preview Answers</button>
      </form>
      {status.message && (
        <div className={`status ${status.type}`}>{status.message}</div>
      )}
    </div>
  );
};

export default ViewerPage;