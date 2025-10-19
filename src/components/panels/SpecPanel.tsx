import { useState } from 'react';
import { useWidgetStore } from '@/store/widgetStore';
import { buildSpec } from '@/utils/specBuilder';
import { parseSpecToBuilderState } from '@/utils/specParser';

export function SpecPanel() {
  const vegaSpec = useWidgetStore((state) => state.vegaSpec);
  const data = useWidgetStore((state) => state.data);
  const dataFields = useWidgetStore((state) => state.dataFields);
  const setSpec = useWidgetStore((state) => state.setSpec);
  const setData = useWidgetStore((state) => state.setData);
  const setDataOnly = useWidgetStore((state) => state.setDataOnly);
  const captureSnapshot = useWidgetStore((state) => state.captureSnapshot);

  const [editMode, setEditMode] = useState(false);
  const [specText, setSpecText] = useState(JSON.stringify(vegaSpec, null, 2));
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDataInSpec, setShowDataInSpec] = useState(false);

  // Get the display spec (optionally with inline data)
  const getDisplaySpec = () => {
    if (showDataInSpec && data.length > 0) {
      const specWithData = { ...vegaSpec };
      specWithData.data = { values: data };
      return JSON.stringify(specWithData, null, 2);
    }
    return JSON.stringify(vegaSpec, null, 2);
  };

  const handleCopy = async () => {
    try {
      const textToCopy = editMode ? specText : getDisplaySpec();
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleDownload = () => {
    const textToDownload = editMode ? specText : getDisplaySpec();
    const blob = new Blob([textToDownload], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'vega-lite-spec.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleEdit = () => {
    setEditMode(true);
    setSpecText(JSON.stringify(vegaSpec, null, 2));
    setError(null);
  };

  const handleSave = () => {
    try {
      const parsed = JSON.parse(specText);

      // Basic validation - check for mark in spec or nested spec (for faceted charts)
      if (!parsed.mark && !parsed.spec?.mark && !parsed.layer) {
        throw new Error('Invalid Vega-Lite spec: missing mark (or layer/spec)');
      }

      // Apply the spec by updating the store directly
      captureSnapshot('Manual spec edit');

      // Check if spec has inline data and extract it
      if (parsed.data && parsed.data.values && Array.isArray(parsed.data.values)) {
        // Has inline data - extract it to Data tab
        const specWithoutData = { ...parsed };
        const extractedData = parsed.data.values;
        delete specWithoutData.data;
        specWithoutData.data = { name: 'table' };

        // Parse the spec back to builder state (best-effort)
        const parsedBuilderState = parseSpecToBuilderState(specWithoutData);

        // Update spec and builder state FIRST (without regenerating from builder state)
        setSpec(specWithoutData, parsedBuilderState);

        // Then update data separately WITHOUT regenerating the spec (preserves custom spec)
        setDataOnly(extractedData);
      } else if (parsed.data && parsed.data.url) {
        // Has external URL - warn user but keep the spec as-is
        if (process.env.NODE_ENV === 'development') {
          console.warn('Spec uses external data URL:', parsed.data.url);
          console.warn('This may fail due to CORS. Consider fetching and pasting as inline data.');
        }

        // Keep the spec as-is (don't try to parse to builder state for complex specs)
        setSpec(parsed, {});
      } else {
        // No data or uses named dataset - keep as-is
        const parsedBuilderState = parseSpecToBuilderState(parsed);
        setSpec(parsed, parsedBuilderState);
      }

      setEditMode(false);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid JSON');
    }
  };

  const handleCancel = () => {
    setEditMode(false);
    setSpecText(JSON.stringify(vegaSpec, null, 2));
    setError(null);
  };

  return (
    <div className="h-full flex flex-col">
      <div className="mb-3">
        <h3 className="text-sm font-semibold mb-2">Vega-Lite Specification</h3>
        <p className="text-xs text-gray-600 mb-3">
          {editMode ? 'Edit the JSON specification directly. ' : 'Copy this JSON specification to use in the '}
          {!editMode && (
            <>
              <a
                href="https://vega.github.io/editor/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-700 underline"
              >
                Vega Editor
              </a>
              {' '}or in your own application.
            </>
          )}
        </p>

        <div className="flex flex-wrap gap-2 items-center">
          {!editMode ? (
            <>
              <button
                onClick={handleEdit}
                className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700 transition-colors"
              >
                Edit Spec
              </button>
              <button
                onClick={handleCopy}
                className="px-3 py-1.5 bg-gray-600 text-white rounded text-sm font-medium hover:bg-gray-700 transition-colors"
              >
                {copied ? '✓ Copied!' : 'Copy'}
              </button>
              <button
                onClick={handleDownload}
                className="px-3 py-1.5 bg-gray-600 text-white rounded text-sm font-medium hover:bg-gray-700 transition-colors"
              >
                Download
              </button>
              <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={showDataInSpec}
                  onChange={(e) => setShowDataInSpec(e.target.checked)}
                  className="w-3.5 h-3.5"
                />
                <span>Include data</span>
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
          <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
            {error}
          </div>
        )}
      </div>

      {editMode ? (
        <div className="flex-1 flex flex-col">
          <label className="text-xs font-semibold mb-1">JSON Specification (editable)</label>
          <textarea
            value={specText}
            onChange={(e) => setSpecText(e.target.value)}
            className="flex-1 p-3 border border-gray-300 rounded font-mono text-xs resize-none"
            spellCheck={false}
          />
        </div>
      ) : (
        <div className="flex-1 overflow-auto border border-gray-300 rounded">
          <pre className="p-3 text-xs font-mono leading-relaxed">
            <code>{getDisplaySpec()}</code>
          </pre>
        </div>
      )}

      {!editMode && (
        <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded text-xs">
          <p className="font-semibold mb-1">💡 Usage Tips:</p>
          <ul className="list-disc list-inside space-y-1 text-gray-700">
            <li>Click "Edit Spec" to modify the JSON directly</li>
            <li>Copy and paste into the Vega Editor to experiment</li>
            <li>Use in your app with Vega-Embed or Vega-Lite libraries</li>
            <li>The spec updates automatically as you modify the chart</li>
          </ul>
        </div>
      )}
    </div>
  );
}
