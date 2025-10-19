import { useEffect, useRef } from 'react';
import embed, { type VisualizationSpec } from 'vega-embed';

interface ChartPreviewProps {
  spec: VisualizationSpec;
  data: any[];
  width?: number | string;
  height?: number | string;
}

export function ChartPreview({ spec, data, width = '100%', height = 400 }: ChartPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Clear previous chart
    containerRef.current.innerHTML = '';

    // Show loading state
    containerRef.current.innerHTML = '<div style="padding: 20px; text-align: center; color: #666;">Loading chart...</div>';

    // Debug logging (development only - no sensitive data)
    if (process.env.NODE_ENV === 'development') {
      console.log('ChartPreview rendering with:');
      console.log('- Data rows:', data.length);
      // Don't log actual data values in production for privacy
      console.log('- Spec type:', spec.mark || spec.facet || spec.layer || 'unknown');
    }

    // Determine if we should inject data or use spec's data source
    let specToRender;

    if (spec.data && (spec.data as any).url) {
      // Spec has external URL - use it as-is
      if (process.env.NODE_ENV === 'development') {
        console.log('Using spec with external data URL:', (spec.data as any).url);
      }
      specToRender = spec;
    } else {
      // Deep clone data to avoid "object is not extensible" error
      // (Zustand with Immer freezes objects, but Vega needs to add Symbol properties)
      const clonedData = JSON.parse(JSON.stringify(data));

      // Inject data directly into spec to ensure it's available for transforms
      specToRender = {
        ...spec,
        data: { values: clonedData },
      };
    }

    // Embed the chart
    embed(containerRef.current, specToRender, {
      actions: {
        export: true,
        source: false,
        compiled: false,
        editor: false,
      },
      renderer: 'canvas',
      mode: 'vega-lite',
    }).then(() => {
      if (process.env.NODE_ENV === 'development') {
        console.log('Chart rendered successfully');
      }
    }).catch((error) => {
      // Always log errors, but sanitize sensitive information
      console.error('Error rendering chart:', error.message || error);
      if (process.env.NODE_ENV === 'development') {
        console.error('Spec:', spec);
        console.error('Data rows:', data.length);
      }
      if (containerRef.current) {
        containerRef.current.innerHTML = `
          <div style="padding: 20px; color: #dc2626; background: #fee2e2; border: 1px solid #fca5a5; border-radius: 4px; margin: 20px;">
            <strong>❌ Error rendering chart:</strong>
            <pre style="margin-top: 8px; font-size: 12px; overflow: auto; white-space: pre-wrap;">${error.message || String(error)}</pre>
            <details style="margin-top: 12px;">
              <summary style="cursor: pointer; font-weight: 600;">Debug Info</summary>
              <pre style="margin-top: 8px; font-size: 11px; overflow: auto; background: white; padding: 8px; border-radius: 4px;">${JSON.stringify({ spec, dataSample: data.slice(0, 2) }, null, 2)}</pre>
            </details>
          </div>
        `;
      }
    });
  }, [spec, data]);

  return (
    <div
      ref={containerRef}
      id="vega-chart-container"
      style={{
        width: typeof width === 'number' ? `${width}px` : width,
        height: typeof height === 'number' ? `${height}px` : height,
        minHeight: '300px',
      }}
    />
  );
}
