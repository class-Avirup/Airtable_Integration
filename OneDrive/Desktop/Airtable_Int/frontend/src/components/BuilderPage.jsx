"use client";

import { useState, useEffect } from "react";
import axios from "axios";
import { useSearchParams, Link } from "react-router-dom";

const SUPPORTED_FIELD_TYPES = [
  "singleLineText", // Short text
  "multilineText", // Long text
  "singleSelect",
  "multipleSelects", // Multi select
  "attachment",
];
const backend = import.meta.env.VITE_BACKEND_LINK;
const BuilderPage = () => {
  const [searchParams] = useSearchParams();
  const userId = searchParams.get("user_id");

  const [bases, setBases] = useState([]);
  const [tables, setTables] = useState([]);
  const [fields, setFields] = useState([]);
  const [fieldConfig, setFieldConfig] = useState({});

  const [selectedBase, setSelectedBase] = useState("");
  const [selectedTable, setSelectedTable] = useState("");
  const [status, setStatus] = useState({ message: "", type: "" });

  useEffect(() => {
    if (userId) {
      axios
        .get(`${backend}/api/bases/${userId}`)
        .then((res) => setBases(res.data.bases))
        .catch((err) =>
          setStatus({ message: "Error fetching bases.", type: "error" })
        );
    }
  }, [userId]);

  const handleBaseChange = (e) => {
    const baseId = e.target.value;
    setSelectedBase(baseId);
    setSelectedTable("");
    setFields([]);
    setTables([]);
    setFieldConfig({});
    if (baseId) {
      axios
        .get(`${backend}/api/tables/${userId}/${baseId}`)
        .then((res) => setTables(res.data.tables))
        .catch((err) =>
          setStatus({ message: "Error fetching tables.", type: "error" })
        );
    }
  };

  const handleTableChange = (e) => {
    const tableId = e.target.value;
    setSelectedTable(tableId);
    setFields([]);
    setFieldConfig({});
    if (tableId) {
      axios
        .get(`${backend}/api/fields/${userId}/${selectedBase}/${tableId}`)
        .then((res) => {
          const supportedFields = res.data.fields.filter((field) =>
            SUPPORTED_FIELD_TYPES.includes(field.type)
          );

          setFields(supportedFields);

          const initialConfig = supportedFields.reduce((acc, field) => {
            acc[field.id] = {
              include: true,
              label: field.name,
              isRequired: false, // <-- ADDED: Default is not required
              conditionalField: "",
              conditionalValue: "",
            };
            return acc;
          }, {});
          setFieldConfig(initialConfig);
        })
        .catch((err) =>
          setStatus({ message: "Error fetching fields.", type: "error" })
        );
    }
  };

  const handleFieldConfigChange = (fieldId, key, value) => {
    setFieldConfig((prev) => ({
      ...prev,
      [fieldId]: {
        ...prev[fieldId],
        [key]: value,
      },
    }));
  };

  const handleSaveConfig = () => {
    const finalFields = fields
      .filter((field) => fieldConfig[field.id]?.include)
      .map((field) => {
        const config = fieldConfig[field.id];
        const conditional =
          config.conditionalField && config.conditionalValue
            ? {
                showIfField: config.conditionalField,
                equalsValue: config.conditionalValue,
              }
            : null;

        return {
          airtableFieldId: field.id,
          name: field.name,
          label: config.label,
          isRequired: config.isRequired, // <-- ADDED: Save the required status
          type: field.type,
          options: field.options,
          conditional,
        };
      });

    axios
      .post(`${backend}/api/form-config`, {
        userId,
        baseId: selectedBase,
        tableId: selectedTable,
        fields: finalFields,
        tableName: tables.find((t) => t.id === selectedTable)?.name || "",
      })
      .then((res) =>
        setStatus({ message: "Configuration saved!", type: "success" })
      )
      .catch((err) =>
        setStatus({ message: "Error saving configuration.", type: "error" })
      );
  };

  if (!userId) {
    return (
      <div className="container">
        <h1>
          User ID not found. Please <Link to="/">authenticate</Link> first.
        </h1>
      </div>
    );
  }

  return (
    <div className="container">
      <h1>Form Builder</h1>
      <p>
        User ID: <strong>{userId}</strong>
      </p>

      <div className="selector">
        <label htmlFor="base">Select a Base</label>
        <select id="base" value={selectedBase} onChange={handleBaseChange}>
          <option value="">-- Select a Base --</option>
          {bases.map((base) => (
            <option key={base.id} value={base.id}>
              {base.name}
            </option>
          ))}
        </select>
      </div>

      {selectedBase && (
        <div className="selector">
          <label htmlFor="table">Select a Table</label>
          <select
            id="table"
            value={selectedTable}
            onChange={handleTableChange}
            disabled={!tables.length}
          >
            <option value="">-- Select a Table --</option>
            {tables.map((table) => (
              <option key={table.id} value={table.id}>
                {table.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {fields.length > 0 && (
        <div className="field-list">
          <h3>Configure Fields</h3>
          {fields.map((field) => (
            <div className="field-item" key={field.id}>
              {/* Field Include Checkbox */}
              <div>
                <input
                  type="checkbox"
                  checked={fieldConfig[field.id]?.include || false}
                  onChange={(e) =>
                    handleFieldConfigChange(
                      field.id,
                      "include",
                      e.target.checked
                    )
                  }
                />
                <strong>{field.name}</strong> <small>({field.type})</small>
              </div>

              <div style={{ marginLeft: "20px", marginTop: "10px" }}>
                {/* Form Label Input */}
                <div>
                  <label>Form Label:</label>
                  <input
                    type="text"
                    value={fieldConfig[field.id]?.label || ""}
                    onChange={(e) =>
                      handleFieldConfigChange(field.id, "label", e.target.value)
                    }
                  />
                </div>

                {/* ADDED: Required Field Checkbox */}
                <div style={{ marginTop: "10px" }}>
                  <input
                    type="checkbox"
                    id={`required-${field.id}`}
                    checked={fieldConfig[field.id]?.isRequired || false}
                    onChange={(e) =>
                      handleFieldConfigChange(
                        field.id,
                        "isRequired",
                        e.target.checked
                      )
                    }
                  />
                  <label
                    htmlFor={`required-${field.id}`}
                    style={{ marginLeft: "5px", fontWeight: "normal" }}
                  >
                    Required?
                  </label>
                </div>

                {/* Conditional Logic */}
                <div style={{ marginTop: "10px" }}>
                  <label>Conditional Logic (Optional):</label>
                  <div>
                    Show if field
                    <select
                      value={fieldConfig[field.id]?.conditionalField || ""}
                      onChange={(e) =>
                        handleFieldConfigChange(
                          field.id,
                          "conditionalField",
                          e.target.value
                        )
                      }
                    >
                      <option value="">-- None --</option>
                      {fields
                        .filter((f) => f.id !== field.id)
                        .map((f) => (
                          <option key={f.id} value={f.id}>
                            {f.name}
                          </option>
                        ))}
                    </select>
                    equals
                    <input
                      type="text"
                      placeholder="value"
                      value={fieldConfig[field.id]?.conditionalValue || ""}
                      onChange={(e) =>
                        handleFieldConfigChange(
                          field.id,
                          "conditionalValue",
                          e.target.value
                        )
                      }
                    />
                  </div>
                </div>
              </div>
            </div>
          ))}
          <button onClick={handleSaveConfig}>Save Configuration</button>
        </div>
      )}

      {status.message && (
        <div className={`status ${status.type}`}>
          {status.message}
          {status.type === "success" && (
            <p>
              <Link to={`/form/${userId}/${selectedBase}/${selectedTable}`}>
                View Your Form
              </Link>
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default BuilderPage;