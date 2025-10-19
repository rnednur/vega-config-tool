import type { BuilderState, ChartEditPlan, DataField, EncodingConfig, Operation } from '@/types';

function norm(s: string) {
  return s.toLowerCase().trim();
}

function colorWordToHex(s: string): string {
  const basic: Record<string, string> = {
    blue: '#1f77b4',
    orange: '#ff7f0e',
    red: '#d62728',
    green: '#2ca02c',
    purple: '#9467bd',
    brown: '#8c564b',
    pink: '#e377c2',
    gray: '#7f7f7f',
    grey: '#7f7f7f',
    yellow: '#bcbd22',
    cyan: '#17becf',
    black: '#111111',
    white: '#ffffff',
  };
  if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(s)) return s;
  return basic[norm(s)] ?? s;
}

function resolveField(candidate: string, fieldNames: string[]): string | undefined {
  if (fieldNames.includes(candidate)) return candidate;
  const ci = fieldNames.find((f) => f.toLowerCase() === candidate.toLowerCase());
  if (ci) return ci;
  const contains = fieldNames.find((f) => f.toLowerCase().includes(candidate.toLowerCase()));
  return contains;
}

function titleCase(s: string) {
  return s.replace(/\b\w/g, (m) => m.toUpperCase());
}

/**
 * Parse natural language input into a ChartEditPlan
 */
export function parseNLToPlan(input: string, fieldNames: string[], builder: BuilderState): ChartEditPlan {
  const text = input.trim();
  const lower = norm(text);
  const ops: Operation[] = [];

  // 1) Mark changes
  const markMatch = lower.match(/(change to|switch to|make it|set to)?\s*(line|bar|area|point|circle|square|tick|rect|rule|text)\s*(chart)?/);
  if (markMatch) {
    ops.push({
      op: 'set_mark',
      mark: markMatch[2] as any,
      options: { point: lower.includes('with points') },
    });
  }

  // 2) Color by <field>
  const colorBy = lower.match(/color (?:lines|bars|points|by)?\s*by\s+([a-zA-Z0-9_]+)/) || lower.match(/color by\s+([a-zA-Z0-9_]+)/);
  if (colorBy && colorBy[1]) {
    const fld = resolveField(colorBy[1], fieldNames);
    if (fld) {
      ops.push({ op: 'set_encoding', channel: 'color', field: fld });
    }
  }

  // 3) "make West blue and East orange"
  if (lower.includes('make ')) {
    const afterMake = lower.split('make ')[1];
    if (afterMake) {
      const pairs = afterMake.split(/\s+and\s+/g).map((s) => s.trim());
      const map: Record<string, string> = {};
      for (const p of pairs) {
        const m = p.match(/^([a-z0-9_\-\s]+)\s+([#a-z0-9_\-]+)$/i);
        if (m) {
          const cat = titleCase(m[1].trim());
          const col = colorWordToHex(m[2].trim());
          map[cat] = col;
        }
      }
      if (Object.keys(map).length) {
        ops.push({ op: 'set_series_colors', colors: map });
      }
    }
  }

  // 4) "top 10" (optionally "by Sales")
  const topN = lower.match(/top\s+(\d+)(?:\s+by\s+([a-zA-Z0-9_]+))?/);
  if (topN) {
    const n = parseInt(topN[1], 10);
    const by = topN[2] ? resolveField(topN[2], fieldNames) : undefined;
    ops.push({ op: 'set_top_n', n: Number.isFinite(n) ? n : 10, byField: by, order: 'descending' });
  }

  // 5) "sort by Sales desc"
  const sort = lower.match(/sort\s+by\s+([a-zA-Z0-9_]+)\s+(ascending|descending|asc|desc)/);
  if (sort) {
    const by = resolveField(sort[1], fieldNames) ?? sort[1];
    const order = /(desc|descending)/.test(sort[2]) ? 'descending' : 'ascending';
    ops.push({ op: 'set_sort', channelOrField: 'y', by, order });
  }

  // 6) "use Region as color"
  const altColor = lower.match(/use\s+([a-zA-Z0-9_]+)\s+as\s+color/);
  if (altColor) {
    const fld = resolveField(altColor[1], fieldNames);
    if (fld) {
      ops.push({ op: 'set_encoding', channel: 'color', field: fld });
    }
  }

  // 7) "set title to X"
  const titleMatch = lower.match(/set title to\s+['""]?([^'""\n]+)['""]?/);
  if (titleMatch) {
    ops.push({ op: 'set_title', title: titleMatch[1].trim() });
  }

  // 8) "use viridis color scheme"
  const schemeMatch = lower.match(/use\s+([a-z0-9]+)\s+(?:color\s+)?scheme/);
  if (schemeMatch) {
    ops.push({ op: 'set_color_scheme', scheme: schemeMatch[1] });
  }

  // If user said "lines" (plural) without explicitly changing mark, nudge line mark
  if (!ops.find((o) => o.op === 'set_mark') && /\blines\b/.test(lower)) {
    ops.push({ op: 'set_mark', mark: 'line' });
  }

  // Confidence: very rough heuristic
  const confidence = Math.min(1, 0.6 + ops.length * 0.08);

  return { intentText: input, confidence, operations: ops };
}

/**
 * Apply a ChartEditPlan to a BuilderState
 */
export function applyPlan(builder: BuilderState, plan: ChartEditPlan, dataFields: DataField[]): BuilderState {
  let next = JSON.parse(JSON.stringify(builder)) as BuilderState;

  const getType = (field: string): EncodingConfig['type'] | undefined =>
    dataFields.find((f) => f.name === field)?.inferredType;

  for (const op of plan.operations) {
    switch (op.op) {
      case 'set_mark': {
        next.mark.type = op.mark;
        if (op.options?.point !== undefined) next.mark.point = op.options.point;
        if (op.options?.stacked !== undefined) next.mark.stacked = op.options.stacked;
        break;
      }

      case 'set_encoding': {
        const t = op.type ?? getType(op.field);
        next.encodings[op.channel] = {
          ...(next.encodings[op.channel] ?? {}),
          field: op.field,
          type: t,
          ...op.config,
        };
        break;
      }

      case 'remove_encoding': {
        next.encodings[op.channel] = undefined;
        break;
      }

      case 'set_series_colors': {
        // Ensure color encoding exists
        if (!next.encodings.color || !next.encodings.color.field) {
          const nominal = dataFields.find((f) => f.inferredType === 'nominal');
          if (nominal) {
            next.encodings.color = { field: nominal.name, type: 'nominal' };
          } else if (dataFields[0]) {
            next.encodings.color = { field: dataFields[0].name, type: getType(dataFields[0].name) };
          }
        }
        if (next.encodings.color) {
          const domain = Object.keys(op.colors);
          const range = domain.map((k) => op.colors[k]);
          next.encodings.color.scale = {
            ...(next.encodings.color.scale ?? {}),
            domain,
            range,
          };
        }
        break;
      }

      case 'set_color_scheme': {
        if (!next.encodings.color) {
          // Try to set color to a nominal field
          const nominal = dataFields.find((f) => f.inferredType === 'nominal');
          if (nominal) {
            next.encodings.color = { field: nominal.name, type: 'nominal' };
          }
        }
        if (next.encodings.color) {
          next.encodings.color.scale = {
            ...(next.encodings.color.scale ?? {}),
            scheme: op.scheme,
          };
        }
        break;
      }

      case 'set_top_n': {
        // Replace existing topN if any
        next.transforms = next.transforms.filter((t) => t.kind !== 'topN');
        const by = op.byField ?? (next.encodings.y?.field ?? next.encodings.x?.field ?? '');
        if (by) {
          next.transforms.push({
            kind: 'topN',
            n: op.n,
            byField: by,
            order: op.order ?? 'descending',
          });
        }
        break;
      }

      case 'set_sort': {
        const order = op.order;
        if (op.channelOrField === 'x' || op.channelOrField === 'y') {
          const ch = op.channelOrField;
          if (!next.encodings[ch]) next.encodings[ch] = {};
          if (op.by && next.encodings[ch]) {
            next.encodings[ch]!.sort = { field: op.by, order };
          } else if (next.encodings[ch]) {
            next.encodings[ch]!.sort = order;
          }
        } else {
          // Field-based sort: try apply to Y
          if (!next.encodings.y) next.encodings.y = {};
          next.encodings.y.sort = { field: op.channelOrField, order };
        }
        break;
      }

      case 'add_filter': {
        next.transforms.push({ kind: 'filter', expr: op.expr });
        break;
      }

      case 'set_aggregate': {
        if (next.encodings[op.channel]) {
          next.encodings[op.channel]!.aggregate = op.op;
        }
        break;
      }

      case 'set_title': {
        next.title = op.title;
        break;
      }

      case 'set_size': {
        if (op.width !== undefined) next.width = op.width;
        if (op.height !== undefined) next.height = op.height;
        break;
      }

      default:
        console.warn('Unknown operation:', op);
        break;
    }
  }

  return next;
}
