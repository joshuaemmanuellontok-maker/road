import { useEffect, useState } from 'react';
import { RouterProvider } from 'react-router';
import { router } from './routes';
import { SoteriaSplash } from './components/SoteriaSplash';

export default function App() {
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    const timer = window.setTimeout(() => setShowSplash(false), 2900);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <>
      <RouterProvider router={router} />
      {showSplash && <SoteriaSplash />}
    </>
  );
}
