import { useState } from 'react';
import { useWidgetStore } from '@/store/widgetStore';

export function DataPanel() {
  const data = useWidgetStore((state) => state.data);
  const dataFields = useWidgetStore((state) => state.dataFields);
  const setData = useWidgetStore((state) => state.setData);

  const [editMode, setEditMode] = useState(false);
  const [jsonText, setJsonText] = useState(JSON.stringify(data, null, 2));
  const [error, setError] = useState<string | null>(null);

  const handleEdit = () => {
    setEditMode(true);
    setJsonText(JSON.stringify(data, null, 2));
    setError(null);
  };

  const handleSave = () => {
    try {
      const parsed = JSON.parse(jsonText);
      if (!Array.isArray(parsed)) {
        throw new Error('Data must be an array of objects');
      }
      if (parsed.length === 0) {
        throw new Error('Data cannot be empty');
      }
      setData(parsed);
      setEditMode(false);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid JSON');
    }
  };

  const handleCancel = () => {
    setEditMode(false);
    setJsonText(JSON.stringify(data, null, 2));
    setError(null);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;

        if (file.name.endsWith('.json')) {
          const parsed = JSON.parse(content);
          if (Array.isArray(parsed)) {
            setData(parsed);
            setError(null);
          } else {
            setError('JSON file must contain an array');
          }
        } else if (file.name.endsWith('.csv')) {
          const parsed = parseCSV(content);
          setData(parsed);
          setError(null);
        }
      } catch (err) {
        setError('Failed to parse file: ' + (err instanceof Error ? err.message : 'Unknown error'));
      }
    };
    reader.readAsText(file);
  };

  const parseCSV = (csv: string): any[] => {
    const lines = csv.trim().split('\n');
    const headers = lines[0].split(',').map(h => h.trim());

    return lines.slice(1).map(line => {
      const values = line.split(',').map(v => v.trim());
      const obj: any = {};
      headers.forEach((header, i) => {
        const value = values[i];
        // Try to parse as number
        const num = Number(value);
        obj[header] = isNaN(num) ? value : num;
      });
      return obj;
    });
  };

  return (
    <div className="h-full flex flex-col">
      <div className="mb-3">
        <h3 className="text-sm font-semibold mb-2">Data</h3>
        <p className="text-xs text-gray-600 mb-3">
          View, edit, or upload your data. Supports JSON and CSV formats.
        </p>

        <div className="flex flex-wrap gap-2 mb-3">
          {!editMode ? (
            <>
              <button
                onClick={handleEdit}
                className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700 transition-colors"
              >
                Edit Data
              </button>
              <label className="px-3 py-1.5 bg-gray-600 text-white rounded text-sm font-medium hover:bg-gray-700 transition-colors cursor-pointer">
                Upload File
                <input
                  type="file"
                  accept=".json,.csv"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </>
          ) : (
            <>
              <button
                onClick={handleSave}
                className="px-3 py-1.5 bg-green-600 text-white rounded text-sm font-medium hover:bg-green-700 transition-colors"
              >
                Save Changes
              </button>
              <button
                onClick={handleCancel}
                className="px-3 py-1.5 bg-gray-400 text-white rounded text-sm font-medium hover:bg-gray-500 transition-colors"
              >
                Cancel
              </button>
            </>
          )}
        </div>

        {error && (
          <div className="p-2 mb-3 bg-red-50 border border-red-200 rounded text-xs text-red-700">
            {error}
          </div>
        )}
      </div>

      {/* Field Information */}
      <div className="mb-3 p-3 bg-gray-50 border border-gray-200 rounded">
        <h4 className="text-xs font-semibold mb-2">Fields ({dataFields.length})</h4>
        <div className="space-y-1">
          {dataFields.map((field) => (
            <div key={field.name} className="flex items-center justify-between text-xs">
              <span className="font-medium">{field.name}</span>
              <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded">
                {field.inferredType}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Data Editor/Viewer */}
      {editMode ? (
        <div className="flex-1 flex flex-col">
          <label className="text-xs font-semibold mb-1">JSON Data (editable)</label>
          <textarea
            value={jsonText}
            onChange={(e) => setJsonText(e.target.value)}
            className="flex-1 p-2 border border-gray-300 rounded font-mono text-xs resize-none"
            spellCheck={false}
          />
        </div>
      ) : (
        <div className="flex-1 overflow-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-gray-100 border-b border-gray-300">
                {dataFields.map((field) => (
                  <th
                    key={field.name}
                    className="px-2 py-1 text-left font-semibold border-r border-gray-300 last:border-r-0"
                  >
                    {field.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.slice(0, 100).map((row, i) => (
                <tr key={i} className="border-b border-gray-200 hover:bg-gray-50">
                  {dataFields.map((field) => (
                    <td
                      key={field.name}
                      className="px-2 py-1 border-r border-gray-200 last:border-r-0"
                    >
                      {String(row[field.name] ?? '')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {data.length > 100 && (
            <div className="p-2 text-xs text-gray-500 text-center bg-gray-50">
              Showing first 100 of {data.length} rows
            </div>
          )}
        </div>
      )}

      {/* Data Stats */}
      <div className="mt-3 p-2 bg-blue-50 border border-blue-200 rounded text-xs">
        <strong>{data.length}</strong> rows × <strong>{dataFields.length}</strong> columns
      </div>
    </div>
  );
}
