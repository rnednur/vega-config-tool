import { VegaConfigWidget } from './components/VegaConfigWidget';

const SAMPLE_DATA = [
  { Category: 'A', Date: '2024-01-01', Sales: 120, Profit: 35, Region: 'West' },
  { Category: 'B', Date: '2024-01-01', Sales: 90, Profit: 22, Region: 'East' },
  { Category: 'A', Date: '2024-02-01', Sales: 150, Profit: 40, Region: 'West' },
  { Category: 'B', Date: '2024-02-01', Sales: 110, Profit: 28, Region: 'East' },
  { Category: 'C', Date: '2024-02-01', Sales: 70, Profit: 15, Region: 'North' },
  { Category: 'A', Date: '2024-03-01', Sales: 180, Profit: 50, Region: 'West' },
  { Category: 'B', Date: '2024-03-01', Sales: 95, Profit: 25, Region: 'East' },
  { Category: 'C', Date: '2024-03-01', Sales: 85, Profit: 20, Region: 'North' },
];

function App() {
  return (
    <div className="w-screen h-screen">
      <VegaConfigWidget
        data={SAMPLE_DATA}
        builderState={{
          mark: { type: 'bar', stacked: null },
          encodings: {
            x: { field: 'Category', type: 'nominal' },
            y: { field: 'Sales', type: 'quantitative', aggregate: 'sum' },
            tooltip: 'auto',
          },
          transforms: [],
        }}
        callbacks={{
          onSpecChange: (spec) => {
            console.log('Spec changed:', spec);
          },
        }}
      />
    </div>
  );
}

export default App;
