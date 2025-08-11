import MonthCalendar from './components/MonthCalendar';
import './index.css';

function App() {
  return (
    <div style={{ display: 'grid', placeItems: 'center', minHeight: '100vh', padding: 16 }}>
      <MonthCalendar />
    </div>
  );
}

export default App;
