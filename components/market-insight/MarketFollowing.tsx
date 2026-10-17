import type { FeedUpdate } from "@/lib/market-feed";
import type { FeedAuthors } from "@/lib/market-feed-authors";
import { MarketUpdateCard } from "./MarketUpdateCard";
import styles from "./MarketFollowing.module.css";

export function MarketFollowing({ updates, authors }: { updates: FeedUpdate[]; authors: FeedAuthors }) {
  if (!updates.length) return null;
  return <section className={styles.following} aria-labelledby="market-following-title"><h2 id="market-following-title">Lees en kijk verder</h2><div className={styles.cards}>{updates.map((update) => <MarketUpdateCard key={update.id} update={update} author={authors[update.id]} compact />)}</div></section>;
}
