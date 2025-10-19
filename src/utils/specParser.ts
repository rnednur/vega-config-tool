import type { VisualizationSpec } from 'vega-embed';
import type { BuilderState, MarkType, EncodingConfig } from '@/types';

/**
 * Parse a Vega-Lite spec back into BuilderState (best-effort)
 */
export function parseSpecToBuilderState(spec: VisualizationSpec): Partial<BuilderState> {
  const builderState: Partial<BuilderState> = {
    encodings: {},
    transforms: [],
  };

  // Parse mark
  if (spec.mark) {
    const markConfig = typeof spec.mark === 'string' ? { type: spec.mark } : spec.mark;
    builderState.mark = {
      type: markConfig.type as MarkType,
      point: markConfig.point,
      stacked: null, // Will try to infer from encoding
    };

    // Check for stacking in encoding
    if (spec.encoding) {
      const yEnc = (spec.encoding as any).y;
      const xEnc = (spec.encoding as any).x;
      if (yEnc?.stack) {
        builderState.mark.stacked = yEnc.stack;
      } else if (xEnc?.stack) {
        builderState.mark.stacked = xEnc.stack;
      }
    }
  }

  // Parse encodings
  if (spec.encoding) {
    const encoding = spec.encoding as any;

    // X encoding (note: x2 is handled by Vega-Lite, we just store x)
    if (encoding.x) {
      builderState.encodings!.x = parseEncodingChannel(encoding.x);
    }

    // Y encoding (note: y2 is handled by Vega-Lite, we just store y)
    if (encoding.y) {
      builderState.encodings!.y = parseEncodingChannel(encoding.y);
    }

    // Color encoding
    if (encoding.color) {
      builderState.encodings!.color = parseEncodingChannel(encoding.color);
    }

    // Size encoding
    if (encoding.size) {
      builderState.encodings!.size = parseEncodingChannel(encoding.size);
    }

    // Tooltip
    if (encoding.tooltip) {
      if (Array.isArray(encoding.tooltip)) {
        builderState.encodings!.tooltip = encoding.tooltip.map((t: any) => parseEncodingChannel(t));
      } else {
        builderState.encodings!.tooltip = 'auto';
      }
    }
  }

  // Parse transforms (basic support)
  if (spec.transform && Array.isArray(spec.transform)) {
    for (const transform of spec.transform) {
      if ((transform as any).filter) {
        builderState.transforms!.push({
          kind: 'filter',
          expr: (transform as any).filter,
        });
      } else if ((transform as any).calculate) {
        builderState.transforms!.push({
          kind: 'calculate',
          calculate: (transform as any).calculate,
          as: (transform as any).as,
        });
      }
      // Note: topN uses window transform which is harder to reverse-parse
    }
  }

  // Parse layout
  if (typeof spec.width === 'number') {
    builderState.width = spec.width;
  } else if (spec.width === undefined) {
    builderState.width = 'container';
  }

  if (typeof spec.height === 'number') {
    builderState.height = spec.height;
  } else if (spec.height === undefined) {
    builderState.height = 'container';
  }

  // Parse title
  if (spec.title) {
    builderState.title = typeof spec.title === 'string' ? spec.title : spec.title.text;
  }

  // Parse description
  if (spec.description) {
    builderState.description = spec.description;
  }

  // Parse background
  if (spec.background) {
    builderState.background = spec.background;
  }

  return builderState;
}

/**
 * Parse a single encoding channel
 */
function parseEncodingChannel(channel: any): EncodingConfig {
  const encoding: EncodingConfig = {};

  if (channel.field) {
    encoding.field = channel.field;
  }

  if (channel.type) {
    encoding.type = channel.type;
  }

  if (channel.aggregate) {
    encoding.aggregate = channel.aggregate;
  }

  if (channel.bin !== undefined) {
    encoding.bin = channel.bin;
  }

  if (channel.timeUnit) {
    encoding.timeUnit = channel.timeUnit;
  }

  if (channel.sort !== undefined) {
    encoding.sort = channel.sort;
  }

  if (channel.scale) {
    encoding.scale = {
      domain: channel.scale.domain,
      range: channel.scale.range,
      scheme: channel.scale.scheme,
      reverse: channel.scale.reverse,
      zero: channel.scale.zero,
    };
  }

  if (channel.axis) {
    encoding.axis = {
      title: channel.axis.title,
      format: channel.axis.format,
      grid: channel.axis.grid,
      labelAngle: channel.axis.labelAngle,
      labelFontSize: channel.axis.labelFontSize,
      titleFontSize: channel.axis.titleFontSize,
    };
  }

  if (channel.legend) {
    encoding.legend = {
      title: channel.legend.title,
      orient: channel.legend.orient,
      labelFontSize: channel.legend.labelFontSize,
      titleFontSize: channel.legend.titleFontSize,
    };
  }

  return encoding;
}
