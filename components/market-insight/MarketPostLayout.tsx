import Link from "next/link";
import { Avatar } from "@/components/ui/Avatar";
import { UsefulReaction } from "@/components/market-insight/UsefulReaction";
import { formatPostPublication } from "@/lib/market-article";

export function MarketPostLayout({ title, author, publishedAt, tags, duration, intro, postId, reaction, children }: {
  title: string; author: { name: string; object_path: string | null; student_id?: string }; publishedAt: string;
  tags: string[]; duration: string | null; intro?: string | null; postId: number;
  reaction: { total: number; active: boolean } | null; children: React.ReactNode;
}) {
  return <div className="market-post">
    <Link href="/market-analysis" className="market-post-back"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m10 5-7 7 7 7M3 12h18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>Alle marktinzichten</Link>
    <article>
      <header className="market-post-header">
        <h1>{title}</h1>
        <div className="market-post-byline">
          <Avatar name={author.name} objectPath={author.object_path} studentId={author.student_id} />
          <div className="min-w-0">
            <p className="market-post-author">{author.name}</p>
            <p className="market-post-meta"><time dateTime={publishedAt}>{formatPostPublication(publishedAt)}</time>{duration ? <><span aria-hidden="true"> · </span>{duration}</> : null}</p>
          </div>
          {tags.length ? <ul className="market-post-tags" aria-label="Markten">{tags.map((tag) => <li key={tag}>{tag}</li>)}</ul> : null}
        </div>
      </header>
      {intro?.trim() ? <p className="market-post-intro">{intro}</p> : null}
      <div className="market-post-content">{children}</div>
      <footer className="market-post-footer">
        <UsefulReaction key={postId} postId={postId} initial={reaction} />
        <p className="market-post-disclaimer">Deze analyse is educatief en geen financieel advies.</p>
      </footer>
    </article>
  </div>;
}
