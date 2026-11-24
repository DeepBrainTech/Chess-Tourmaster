import { useEffect, useId, useRef, useState } from 'react';
import { PortalApiError, type Assets, type Cost, type ShopCatalog } from '@/lib/portal-client';
import { GameIcon } from './GameArtwork';
import dialogStyles from './ClassicResultDialog.module.css';
import styles from './GameShopDialog.module.css';

const HINT_ITEM_ID = 'chess_tourmaster_hint';
export const UNDO_ITEM_ID = 'chess_tourmaster_undo';

const singles = [
  { id: HINT_ITEM_ID, title: 'Hint', kind: 'hint' },
  { id: UNDO_ITEM_ID, title: 'Undo', kind: 'undo' },
] as const;

const packs = [
  { id: 'chess_tourmaster_hint_pack5', title: 'Hint Pack', hints: 5, undos: 0, kind: 'hint' },
  { id: 'chess_tourmaster_undo_pack5', title: 'Undo Pack', hints: 0, undos: 5, kind: 'undo' },
  { id: 'chess_tourmaster_utility_pack', title: 'Utility Pack', hints: 3, undos: 5, kind: 'utility' },
] as const;

const currencies = ['coins', 'diamonds', 'flowers'] as const;
const priceFormat = new Intl.NumberFormat('en-US');
type Product = typeof singles[number] | typeof packs[number];
type ItemKind = 'hint' | 'undo';

type Props = {
  assets: Assets | null;
  hints: number;
  undos: number;
  load: (signal: AbortSignal) => Promise<ShopCatalog>;
  buy: (sku: string) => Promise<void>;
  onClose: () => void;
};

function listedCost(catalog: ShopCatalog | null, product: Product): Cost | undefined {
  const listing = catalog?.[product.id];
  const cost = listing?.cost;
  if (!cost || !Object.keys(cost).length || !Object.keys(cost).every(key => currencies.includes(key as keyof Assets))
    || !Object.values(cost).every(value => Number.isSafeInteger(value) && value >= 0)) return undefined;
  if ('hints' in product && ((listing.grants?.[HINT_ITEM_ID] ?? 0) !== product.hints
    || (listing.grants?.[UNDO_ITEM_ID] ?? 0) !== product.undos)) return undefined;
  return cost;
}

function canAfford(cost: Cost, assets: Assets | null) {
  return assets !== null && currencies.every(currency => assets[currency] >= (cost[currency] ?? 0));
}

function priceParts(cost: Cost) {
  return currencies.flatMap(currency => cost[currency] ? [[currency, priceFormat.format(cost[currency])] as const] : []);
}

function ItemIcon({ kind, small = false }: { kind: ItemKind; small?: boolean }) {
  const [width, height] = kind === 'hint' ? (small ? [16.8696, 23.8947] : [23.6175, 33.4526])
    : (small ? [20.3727, 21.579] : [28.5218, 30.2105]);
  return <span className={styles.itemIcon} data-kind={kind} data-small={small} aria-hidden="true">
    <GameIcon directory="game-shop" name={small ? `utility-${kind}` : kind} width={width} height={height} />
  </span>;
}

function PackArtwork({ kind }: { kind: typeof packs[number]['kind'] }) {
  if (kind === 'utility') return <div className={styles.utilityArt} aria-hidden="true">
    <div className={`${styles.fan} ${styles.utilityHints}`}>
      <ItemIcon kind="hint" small /><ItemIcon kind="hint" small /><ItemIcon kind="hint" small />
    </div>
    <div className={`${styles.fan} ${styles.utilityUndos}`}>
      {Array.from({ length: 5 }, (_, index) => <ItemIcon kind="undo" small key={index} />)}
    </div>
  </div>;
  return <div className={styles.fan} aria-hidden="true">
    <ItemIcon kind={kind} /><ItemIcon kind={kind} /><ItemIcon kind={kind} />
  </div>;
}

export default function GameShopDialog({ assets, hints, undos, load, buy, onClose }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const submitting = useRef(false);
  const heading = useId();
  const [catalog, setCatalog] = useState<ShopCatalog | null>(null);
  const [reload, setReload] = useState(0);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (dialog.current && !dialog.current.open) dialog.current.showModal();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal).then(items => {
      if (!controller.signal.aborted) setCatalog(items);
    }).catch(() => {
      if (!controller.signal.aborted) setError('Could not load the shop. Please close it and try again.');
    });
    return () => controller.abort();
  }, [load, reload]);

  async function purchase(product: Product) {
    const cost = listedCost(catalog, product);
    if (submitting.current || !dialog.current?.open || !cost || !canAfford(cost, assets)) return;
    submitting.current = true;
    setPending(product.id);
    setError(null);
    try {
      await buy(product.id);
      dialog.current?.close();
    } catch (cause) {
      if (cause instanceof PortalApiError && cause.code === 'insufficient_assets') {
        setError('Insufficient balance.');
        setCatalog(null);
        setReload(previous => previous + 1);
      } else {
        setError(cause instanceof Error ? cause.message : 'Purchase failed. Please try again.');
      }
    } finally {
      submitting.current = false;
      setPending(null);
    }
  }

  function buyButton(product: Product) {
    const cost = listedCost(catalog, product);
    const prices = cost ? priceParts(cost) : [];
    const label = prices.map(([currency, amount]) => `${amount} ${currency}`).join(' + ') || (cost ? 'Free' : '');
    const reason = !cost ? (catalog ? 'Unavailable' : 'Price unavailable') : !canAfford(cost, assets) ? 'Insufficient balance' : undefined;
    return <button type="button" className={`${dialogStyles.button} ${styles.buy}`} disabled={Boolean(reason || pending)}
      aria-label={`Buy ${product.title}${label ? ` for ${label}` : ''}${reason ? `, ${reason}` : ''}`}
      title={reason} onClick={() => void purchase(product)}>
      {pending === product.id ? '…' : !cost ? '—' : prices.length ? prices.map(([currency, amount]) => <span className={styles.price} key={currency}>
        {currency === 'coins' ? <span className={styles.coin}><GameIcon directory="game-shop" name="coin" width={35.0375} height={37.0619} /></span> : null}
        {amount}{currency !== 'coins' && <small>{currency}</small>}
      </span>) : 'Free'}
    </button>;
  }

  const hintPrice = listedCost(catalog, singles[0])?.coins;
  const undoPrice = listedCost(catalog, singles[1])?.coins;

  return <dialog ref={dialog} className={`${dialogStyles.dialog} ${styles.dialog}`} aria-labelledby={heading}
    onClose={onClose} onCancel={event => { if (submitting.current) event.preventDefault(); }}>
    <form method="dialog" className={`${dialogStyles.panel} ${styles.panel}`}>
      <h1 id={heading} className={`${dialogStyles.title} ${styles.title}`}>Shop</h1>
      <section className={styles.section} aria-label="Buy one">
        <h2>Buy One</h2>
        <div className={styles.singles}>
          {singles.map(item => <article className={styles.single} key={item.id}>
            <ItemIcon kind={item.kind} />
            <div className={styles.copy}><h3>{item.title}</h3><p>You have {item.kind === 'hint' ? hints : undos}</p></div>
            {buyButton(item)}
          </article>)}
        </div>
      </section>
      <section className={styles.section} aria-label="Packs – save coins">
        <h2>Packs – Save Coins</h2>
        <div className={styles.packs}>
          {packs.map(pack => {
            const cost = listedCost(catalog, pack);
            const original = hintPrice !== undefined && undoPrice !== undefined ? pack.hints * hintPrice + pack.undos * undoPrice : 0;
            const discount = cost?.coins !== undefined && original > cost.coins && !cost.diamonds && !cost.flowers
              ? Math.round((original - cost.coins) / original * 100) : 0;
            const description = [pack.hints && `${pack.hints} Hints`, pack.undos && `${pack.undos} Undos`].filter(Boolean).join(' + ');
            return <article className={styles.pack} data-kind={pack.kind} key={pack.id}>
              {pack.kind === 'utility' && <span className={styles.best}>Best Deal</span>}
              {discount > 0 && <span className={styles.discount} aria-label={`Save ${discount}%`}>
                <GameIcon directory="game-shop" name="discount-minus" width={19.79} height={7.79} />{discount}%
              </span>}
              <PackArtwork kind={pack.kind} />
              <div className={styles.copy}><h3>{pack.title}</h3><p>{description}</p></div>
              <div className={styles.packPrices}>
                {discount > 0 && <span className={styles.original} aria-label={`Regular price ${priceFormat.format(original)} coins`}>
                  <GameIcon directory="game-shop" name="old-coin" width={32.5926} height={34.061} />
                  <s>{priceFormat.format(original)}</s>
                </span>}
                {buyButton(pack)}
              </div>
            </article>;
          })}
        </div>
      </section>
      {error ? <p className={styles.status} role="alert">{error}</p>
        : (!catalog || pending) && <p className={styles.status} role="status">{pending ? 'Processing purchase…' : 'Loading shop…'}</p>}
      <button type="submit" aria-label="Close shop" className={`${dialogStyles.button} ${dialogStyles.close} ${styles.close}`} disabled={pending !== null}>
        <GameIcon directory="classic-results" name="close" width={25.1881} height={26.5263} />
      </button>
    </form>
  </dialog>;
}
