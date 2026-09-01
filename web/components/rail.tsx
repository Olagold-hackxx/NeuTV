'use client';

import { useEffect, useRef } from 'react';
import { PanelLeftClose, PanelLeftOpen, X, Tv, LayoutGrid } from 'lucide-react';
import type { Product } from '@/lib/types';
import { Logo } from './logo';

type RailProps = {
  products: Product[];
  activeProduct: string;
  onSelectProduct: (id: string) => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  drawerOpen: boolean;
  onCloseDrawer: () => void;
  skeletonPreview: boolean;
  onToggleSkeletons: () => void;
};

// The five ecosystem logos differ wildly in weight and colour, so at rest they
// render desaturated and dimmed; the active product gets full colour plus a
// cyan bar — a second signal that is not colour alone.
function ProductLogo({ product, active }: { product: Product; active: boolean }) {
  if (product.logo) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={product.logo}
        alt=""
        className={`h-6 w-6 shrink-0 rounded-chip object-cover transition ${active ? '' : 'opacity-60 grayscale'}`}
      />
    );
  }
  return (
    <span
      className={`grid h-6 w-6 shrink-0 place-items-center rounded-chip text-[10px] font-extrabold ${
        active ? 'bg-obsidian text-cyan' : 'bg-obsidian text-faint'
      }`}
    >
      {product.name.slice(0, 2).toUpperCase()}
    </span>
  );
}

function RailBody({
  products,
  activeProduct,
  onSelectProduct,
  collapsed,
  onToggleCollapsed,
  skeletonPreview,
  onToggleSkeletons,
  inDrawer,
}: RailProps & { inDrawer?: boolean }) {
  const showLabels = !collapsed || inDrawer;
  const entries = [{ id: 'all', name: 'All products' } as Product, ...products];

  return (
    <div className="flex h-full flex-col gap-5 p-3">
      <div className={`flex items-center ${showLabels ? 'justify-between pl-2' : 'justify-center'}`}>
        {showLabels ? (
          <Logo width={96} priority />
        ) : null}
        {!showLabels ? <Logo compact priority /> : null}
        {!inDrawer ? (
          <button
            type="button"
            onClick={onToggleCollapsed}
            title={collapsed ? 'Expand navigation' : 'Collapse navigation'}
            className="grid h-8 w-8 place-items-center rounded-control text-dim transition hover:bg-obsidian hover:text-ink"
          >
            {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
          </button>
        ) : null}
      </div>

      <nav aria-label="Products" className="flex flex-col gap-0.5">
        {entries.map((product) => {
          const active = activeProduct === product.id;
          return (
            <button
              key={product.id}
              type="button"
              onClick={() => onSelectProduct(product.id)}
              aria-current={active ? 'true' : undefined}
              title={showLabels ? undefined : product.name}
              className={`flex items-center gap-3 rounded-control px-2.5 py-2 text-left text-[13px] font-semibold transition ${
                active ? 'bg-obsidian text-ink shadow-[inset_2px_0_0_var(--color-cyan)]' : 'text-dim hover:bg-obsidian hover:text-ink'
              } ${showLabels ? '' : 'justify-center px-0'}`}
            >
              {product.id === 'all' ? (
                <LayoutGrid size={18} className={`shrink-0 ${active ? 'text-cyan' : ''}`} />
              ) : (
                <ProductLogo product={product} active={active} />
              )}
              {showLabels ? <span className="truncate">{product.name}</span> : null}
            </button>
          );
        })}
      </nav>

      {/* The community hubs list lived here and was removed: it repeated the
          product list above it, name for name, and both buttons called
          onSelectProduct with the same id. Selecting a product is what opens
          its hub, and the chat rail already shows that hub's channels. */}
      <div className="flex-1" />

      <div className={showLabels ? '' : 'flex justify-center'}>
        <button
          type="button"
          onClick={onToggleSkeletons}
          title="Preview every loading state"
          aria-pressed={skeletonPreview}
          className={`flex items-center gap-2 rounded-control px-2.5 py-1.5 text-xs font-semibold transition ${
            skeletonPreview ? 'bg-obsidian text-cyan' : 'text-faint hover:text-dim'
          }`}
        >
          <Tv size={14} />
          {showLabels ? <span>{skeletonPreview ? 'Hide loading states' : 'Preview loading states'}</span> : null}
        </button>
      </div>
    </div>
  );
}

export function Rail(props: RailProps) {
  const { drawerOpen, onCloseDrawer, collapsed } = props;
  const drawerRef = useRef<HTMLDivElement>(null);

  // The drawer is the one intentional focus trap on the page.
  useEffect(() => {
    if (!drawerOpen) return;
    const el = drawerRef.current;
    if (!el) return;
    const focusable = () =>
      Array.from(el.querySelectorAll<HTMLElement>('button, a, [tabindex]:not([tabindex="-1"])'));
    focusable()[0]?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseDrawer();
      if (e.key !== 'Tab') return;
      const items = focusable();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [drawerOpen, onCloseDrawer]);

  return (
    <>
      <aside
        className={`sticky top-0 hidden h-dvh shrink-0 border-r border-line bg-midnight transition-[width] duration-(--duration-base) md:block ${
          collapsed ? 'w-[72px]' : 'w-[264px]'
        }`}
      >
        <RailBody {...props} />
      </aside>

      {drawerOpen ? (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
          <button
            type="button"
            aria-label="Close navigation"
            onClick={onCloseDrawer}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />
          <div ref={drawerRef} className="absolute inset-y-0 left-0 w-[280px] bg-midnight shadow-overlay">
            <div className="flex justify-end p-2">
              <button
                type="button"
                onClick={onCloseDrawer}
                aria-label="Close navigation"
                className="grid h-9 w-9 place-items-center rounded-control text-dim hover:bg-obsidian hover:text-ink"
              >
                <X size={18} />
              </button>
            </div>
            <RailBody {...props} inDrawer />
          </div>
        </div>
      ) : null}
    </>
  );
}
