import { useWidgetStore } from '@/store/widgetStore';
import type { FieldType, AggregateOp, EncodingConfig } from '@/types';

const AGGREGATE_OPS: AggregateOp[] = ['sum', 'mean', 'median', 'count', 'min', 'max', 'distinct', 'q1', 'q3'];

interface EncodingChannelProps {
  label: string;
  channel: 'x' | 'y' | 'color' | 'size';
  encoding?: EncodingConfig;
  onUpdate: (config: EncodingConfig | undefined) => void;
}

function EncodingChannel({ label, channel, encoding, onUpdate }: EncodingChannelProps) {
  const dataFields = useWidgetStore((state) => state.dataFields);

  const handleFieldChange = (field: string) => {
    if (!field) {
      onUpdate(undefined);
      return;
    }

    const fieldInfo = dataFields.find((f) => f.name === field);
    onUpdate({
      field,
      type: fieldInfo?.inferredType || 'nominal',
      aggregate: encoding?.aggregate,
      sort: encoding?.sort,
    });
  };

  const handleTypeChange = (type: FieldType) => {
    if (!encoding) return;
    onUpdate({ ...encoding, type });
  };

  const handleAggregateChange = (aggregate: string) => {
    if (!encoding) return;
    onUpdate({
      ...encoding,
      aggregate: aggregate === '' ? undefined : (aggregate as AggregateOp),
    });
  };

  return (
    <div className="p-3 border border-gray-300 rounded mb-3">
      <div className="flex items-center justify-between mb-2">
        <label className="text-sm font-semibold">{label}</label>
        {encoding && (
          <button
            onClick={() => onUpdate(undefined)}
            className="text-xs text-red-600 hover:text-red-700"
            title="Remove encoding"
          >
            Remove
          </button>
        )}
      </div>

      <div className="space-y-2">
        <div>
          <label className="text-xs text-gray-600 block mb-1">Field</label>
          <select
            value={encoding?.field || ''}
            onChange={(e) => handleFieldChange(e.target.value)}
            className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
          >
            <option value="">— Select field —</option>
            {dataFields.map((f) => (
              <option key={f.name} value={f.name}>
                {f.name} ({f.inferredType[0].toUpperCase()})
              </option>
            ))}
          </select>
        </div>

        {encoding && (
          <>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-gray-600 block mb-1">Type</label>
                <select
                  value={encoding.type || 'nominal'}
                  onChange={(e) => handleTypeChange(e.target.value as FieldType)}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                >
                  <option value="quantitative">Quantitative</option>
                  <option value="nominal">Nominal</option>
                  <option value="ordinal">Ordinal</option>
                  <option value="temporal">Temporal</option>
                </select>
              </div>

              <div>
                <label className="text-xs text-gray-600 block mb-1">Aggregate</label>
                <select
                  value={encoding.aggregate || ''}
                  onChange={(e) => handleAggregateChange(e.target.value)}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                >
                  <option value="">None</option>
                  {AGGREGATE_OPS.map((op) => (
                    <option key={op} value={op}>
                      {op}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export function EncodingsPanel() {
  const builderState = useWidgetStore((state) => state.builderState);
  const vegaSpec = useWidgetStore((state) => state.vegaSpec);
  const setBuilderState = useWidgetStore((state) => state.setBuilderState);
  const captureSnapshot = useWidgetStore((state) => state.captureSnapshot);

  // Detect if current spec is a complex/custom spec
  const isCustomSpec = !!(
    vegaSpec.facet ||
    vegaSpec.layer ||
    vegaSpec.hconcat ||
    vegaSpec.vconcat ||
    vegaSpec.repeat ||
    (vegaSpec.transform && vegaSpec.transform.length > 3) ||
    (vegaSpec.data && (vegaSpec.data as any).url)
  );

  if (isCustomSpec) {
    return (
      <div className="space-y-4">
        <div className="p-4 bg-yellow-50 border border-yellow-300 rounded">
          <div className="flex items-start gap-2">
            <span className="text-yellow-600 font-bold text-lg">⚠️</span>
            <div className="flex-1">
              <p className="text-sm font-semibold text-yellow-800 mb-2">
                Custom Spec - Builder Disabled
              </p>
              <p className="text-xs text-yellow-700 mb-3">
                You're viewing a complex spec (faceted, layered, or with external data) that can't be edited through the builder panels.
              </p>
              <p className="text-xs font-semibold text-yellow-800 mb-1">Options:</p>
              <ul className="text-xs text-yellow-700 space-y-1 list-disc list-inside">
                <li>Use the <strong>AI Assistant</strong> tab (GenAI mode) to modify this spec</li>
                <li>Use the <strong>Spec</strong> tab to manually edit the JSON</li>
                <li>Reset to a simple chart to use the builder</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const handleEncodingUpdate = (channel: 'x' | 'y' | 'color' | 'size', config: EncodingConfig | undefined) => {
    captureSnapshot(`Update ${channel} encoding`);
    setBuilderState({
      encodings: {
        ...builderState.encodings,
        [channel]: config,
      },
    });
  };

  return (
    <div className="space-y-1">
      <h3 className="text-sm font-semibold mb-3">Encodings</h3>

      <EncodingChannel
        label="X Axis"
        channel="x"
        encoding={builderState.encodings.x}
        onUpdate={(config) => handleEncodingUpdate('x', config)}
      />

      <EncodingChannel
        label="Y Axis"
        channel="y"
        encoding={builderState.encodings.y}
        onUpdate={(config) => handleEncodingUpdate('y', config)}
      />

      <EncodingChannel
        label="Color"
        channel="color"
        encoding={builderState.encodings.color}
        onUpdate={(config) => handleEncodingUpdate('color', config)}
      />

      <EncodingChannel
        label="Size"
        channel="size"
        encoding={builderState.encodings.size}
        onUpdate={(config) => handleEncodingUpdate('size', config)}
      />
    </div>
  );
}
