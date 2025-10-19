import type { VisualizationSpec } from 'vega-embed';
import type { BuilderState, DataField, ChartTransform } from '@/types';

/**
 * Build a Vega-Lite spec from BuilderState
 */
export function buildSpec(state: BuilderState, fields: DataField[]): VisualizationSpec {
  // Build transforms
  const transforms: any[] = buildTransforms(state.transforms);

  // Build encoding
  const encoding: any = {};

  // X encoding
  if (state.encodings.x?.field) {
    encoding.x = buildEncodingChannel(state.encodings.x);
  }

  // Y encoding
  if (state.encodings.y?.field) {
    encoding.y = buildEncodingChannel(state.encodings.y);
  }

  // Color encoding
  if (state.encodings.color?.field) {
    encoding.color = buildEncodingChannel(state.encodings.color);
  }

  // Size encoding
  if (state.encodings.size?.field) {
    encoding.size = buildEncodingChannel(state.encodings.size);
  }

  // Tooltip encoding
  if (state.encodings.tooltip === 'auto') {
    encoding.tooltip = fields.slice(0, 6).map((f) => ({
      field: f.name,
      type: f.inferredType,
    }));
  } else if (Array.isArray(state.encodings.tooltip)) {
    encoding.tooltip = state.encodings.tooltip.map((t) => ({
      field: t.field,
      type: t.type,
      aggregate: t.aggregate,
      format: t.axis?.format,
    }));
  }

  // Build mark
  const mark: any = {
    type: state.mark.type,
    tooltip: true,
  };

  if (state.mark.point !== undefined) {
    mark.point = state.mark.point;
  }

  if (state.mark.opacity !== undefined) {
    mark.opacity = state.mark.opacity;
  }

  if (state.mark.size !== undefined) {
    mark.size = state.mark.size;
  }

  if (state.mark.strokeWidth !== undefined) {
    mark.strokeWidth = state.mark.strokeWidth;
  }

  if (state.mark.interpolate && (state.mark.type === 'line' || state.mark.type === 'area')) {
    mark.interpolate = state.mark.interpolate;
  }

  // Build the spec
  const spec: VisualizationSpec = {
    $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
    width: typeof state.width === 'number' ? state.width : undefined,
    height: typeof state.height === 'number' ? state.height : undefined,
    data: { name: 'table' },
    mark,
    encoding,
    config: {
      view: {
        continuousWidth: state.width === 'container' ? undefined : 400,
        continuousHeight: state.height === 'container' ? undefined : 300,
      },
      axis: {
        labelFontSize: 11,
        titleFontSize: 12,
      },
    },
  };

  // Add transforms if any
  if (transforms.length > 0) {
    spec.transform = transforms;
  }

  // Add title if specified
  if (state.title) {
    spec.title = state.title;
  }

  // Add description if specified
  if (state.description) {
    spec.description = state.description;
  }

  // Add background if specified
  if (state.background) {
    spec.background = state.background;
  }

  // Add padding if specified
  if (state.padding !== undefined) {
    spec.padding = state.padding;
  }

  // Handle stacking for bar/area marks
  if (state.mark.stacked && (state.mark.type === 'bar' || state.mark.type === 'area')) {
    const qChan = encoding.y?.type === 'quantitative' ? 'y' : encoding.x?.type === 'quantitative' ? 'x' : null;
    if (qChan && encoding[qChan]) {
      encoding[qChan].stack = state.mark.stacked;
    }
  }

  return spec;
}

/**
 * Build encoding configuration for a channel
 */
function buildEncodingChannel(config: any): any {
  const channel: any = {
    field: config.field,
    type: config.type,
  };

  if (config.aggregate) {
    channel.aggregate = config.aggregate;
  }

  if (config.bin !== undefined) {
    channel.bin = config.bin;
  }

  if (config.timeUnit) {
    channel.timeUnit = config.timeUnit;
  }

  if (config.sort !== undefined) {
    channel.sort = config.sort;
  }

  if (config.scale) {
    channel.scale = config.scale;
  }

  if (config.axis) {
    channel.axis = {
      title: config.axis.title,
      format: config.axis.format,
      grid: config.axis.grid,
      labelAngle: config.axis.labelAngle,
      labelFontSize: config.axis.labelFontSize,
      titleFontSize: config.axis.titleFontSize,
    };
  }

  if (config.legend) {
    channel.legend = {
      title: config.legend.title,
      orient: config.legend.orient,
      labelFontSize: config.legend.labelFontSize,
      titleFontSize: config.legend.titleFontSize,
    };
  }

  return channel;
}

/**
 * Build Vega-Lite transforms from ChartTransform array
 */
function buildTransforms(transforms: ChartTransform[]): any[] {
  const vegaTransforms: any[] = [];

  for (const t of transforms) {
    switch (t.kind) {
      case 'filter':
        vegaTransforms.push({ filter: t.expr });
        break;

      case 'topN':
        // Implement top-N using window rank + filter
        vegaTransforms.push(
          {
            window: [{ op: 'rank', as: '__rank__' }],
            sort: [{ field: t.byField, order: t.order }],
          },
          { filter: `datum.__rank__ <= ${t.n}` }
        );
        break;

      case 'calculate':
        vegaTransforms.push({
          calculate: t.calculate,
          as: t.as,
        });
        break;

      case 'aggregate':
        vegaTransforms.push({
          aggregate: t.ops.map((op, i) => ({
            op,
            field: t.fields[i],
            as: t.as[i],
          })),
          groupby: t.groupby,
        });
        break;

      default:
        console.warn('Unknown transform kind:', (t as any).kind);
    }
  }

  return vegaTransforms;
}

/**
 * Get default builder state
 */
export function getDefaultBuilderState(): BuilderState {
  return {
    mark: {
      type: 'bar',
      stacked: null,
    },
    encodings: {
      tooltip: 'auto',
    },
    transforms: [],
    width: 'container',
    height: 360,
  };
}
