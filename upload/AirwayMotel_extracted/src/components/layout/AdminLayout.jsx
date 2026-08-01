import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';

export default function AdminLayout() {
  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <div className="ml-64 flex flex-col min-h-screen">
        <Header />
        <main className="flex-1 flex flex-col pt-14">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
