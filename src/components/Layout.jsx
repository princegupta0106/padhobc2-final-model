import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';

const Layout = () => {
  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Sidebar />
      <main className="flex-1 lg:ml-64 overflow-y-auto overflow-x-hidden w-full">
        <Outlet />
      </main>
    </div>
  );
};

export default Layout;
  