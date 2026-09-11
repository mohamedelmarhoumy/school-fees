export function SkeletonLine({ width = '100%', height = 14, style = {} }) {
  return <div className="skeleton" style={{ width, height, ...style }} />;
}

/** كروت هيكلية بديلة لنص "جارِ التحميل..." أثناء جلب قوائم البيانات. */
export function SkeletonCards({ count = 3 }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card" style={{ animationDelay: `${i * 0.04}s` }}>
          <div className="row-between">
            <SkeletonLine width="55%" height={16} />
            <SkeletonLine width={60} height={24} style={{ borderRadius: 8 }} />
          </div>
          <div style={{ marginTop: 10 }}>
            <SkeletonLine width="35%" height={12} />
          </div>
        </div>
      ))}
    </>
  );
}
