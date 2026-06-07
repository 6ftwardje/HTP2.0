export function ExamAnalyticsPlaceholder() {
  return (
    <section className="cb-panel p-6" aria-labelledby="exam-analytics-heading">
      <h3 id="exam-analytics-heading" className="cb-section-title">
        Exam analytics
      </h3>
      <p className="cb-body mt-2 max-w-prose">
        Reserved for a later phase: per-question review, attempt timelines, drop-off points, and module
        diagnostics. The data layer on this page is grouped by module so we can plug reports in without
        restructuring routes.
      </p>
    </section>
  );
}
