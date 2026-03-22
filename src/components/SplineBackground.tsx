import { lazy, Suspense } from 'react';

const Spline = lazy(() => import('@splinetool/react-spline'));

// Replace this with your Spline scene URL after designing it
const SPLINE_SCENE_URL = '';

export default function SplineBackground() {
  if (!SPLINE_SCENE_URL) return null;

  return (
    <div className="spline-bg">
      <Suspense fallback={null}>
        <Spline scene={SPLINE_SCENE_URL} />
      </Suspense>
      <div className="spline-bg-overlay" />
    </div>
  );
}
