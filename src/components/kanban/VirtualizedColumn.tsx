import { useState, useRef, useEffect, useCallback } from 'react';
import { KanbanCard, type BadgeFilters } from './KanbanCard';
import type { Database } from '../../lib/database.types';

type OS = Database['public']['Tables']['os']['Row'];

const CARD_HEIGHT_ESTIMATE = 120;
const OVERSCAN = 5;

interface VirtualizedColumnProps {
  cards: OS[];
  colunaId: string;
  colunaColor: string;
  textColor: string;
  badgeFilters: BadgeFilters;
  mostrarInfoFinanceira: boolean;
  searchMatchSource: Record<string, 'hidden' | 'visible'>;
  draggedCard: OS | null;
  columnSortOrder: string;
  dragOverColumn: string | null;
  dragOverPosition: number | null;
  onDragStart: (e: React.DragEvent, os: OS) => void;
  onDragEnd: (e: React.DragEvent) => void;
  onCardDragOver: (e: React.DragEvent, colunaId: string, index: number) => void;
  onDrop: (e: React.DragEvent, colunaId: string) => void;
  onCardClick: (os: OS) => void;
  onAnalise: (os: OS) => void;
  onIniciarReparo: (os: OS) => void;
  onFecharOS: (os: OS) => void;
  onMoveOS: (os: OS, targetColumn: string) => void;
  onArchive?: (os: OS) => void;
  allColunas: { id: string; label: string }[];
  rotas: Array<{ id: string; nome: string; cor: string | null; cidades: string[]; coluna_kanban: string }>;
  ColumnIcon: React.ElementType;
}

export function VirtualizedColumn({
  cards, colunaId, colunaColor, textColor, badgeFilters,
  mostrarInfoFinanceira, searchMatchSource, draggedCard, columnSortOrder,
  dragOverColumn, dragOverPosition, onDragStart, onDragEnd,
  onCardDragOver, onDrop, onCardClick, onAnalise, onIniciarReparo, onFecharOS,
  onMoveOS, onArchive, allColunas, rotas, ColumnIcon
}: VirtualizedColumnProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);
  const cardHeightsRef = useRef<Map<string, number>>(new Map());
  const [, setMeasuredCount] = useState(0);

  const getCardHeight = useCallback((id: string) => {
    return cardHeightsRef.current.get(id) || CARD_HEIGHT_ESTIMATE;
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerHeight(entry.contentRect.height);
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const handleScroll = useCallback(() => {
    if (scrollRef.current) {
      setScrollTop(scrollRef.current.scrollTop);
    }
  }, []);

  const measureCard = useCallback((id: string, el: HTMLDivElement | null) => {
    if (!el) return;
    const height = el.getBoundingClientRect().height + 8;
    const prev = cardHeightsRef.current.get(id);
    if (prev !== height) {
      cardHeightsRef.current.set(id, height);
      setMeasuredCount(c => c + 1);
    }
  }, []);

  let totalHeight = 0;
  const offsets: number[] = [];
  for (let i = 0; i < cards.length; i++) {
    offsets.push(totalHeight);
    totalHeight += getCardHeight(cards[i].id);
  }

  let startIndex = 0;
  let endIndex = cards.length - 1;

  if (containerHeight > 0 && cards.length > 0) {
    for (let i = 0; i < cards.length; i++) {
      if (offsets[i] + getCardHeight(cards[i].id) >= scrollTop) {
        startIndex = Math.max(0, i - OVERSCAN);
        break;
      }
    }
    for (let i = startIndex; i < cards.length; i++) {
      if (offsets[i] >= scrollTop + containerHeight) {
        endIndex = Math.min(cards.length - 1, i + OVERSCAN);
        break;
      }
    }
  }

  const visibleCards = cards.slice(startIndex, endIndex + 1);

  if (cards.length === 0) {
    return (
      <div className="flex-1 min-h-0 overflow-y-auto cyber-scrollbar px-3 pb-3" ref={scrollRef}>
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center mb-2"
            style={{
              background: `linear-gradient(135deg, ${colunaColor}15 0%, ${colunaColor}05 100%)`,
              border: `1px dashed ${colunaColor}30`,
              boxShadow: `0 0 15px ${colunaColor}10, inset 0 0 10px ${colunaColor}05`
            }}
          >
            <ColumnIcon className="w-6 h-6" style={{ color: `${textColor}60` }} />
          </div>
          <p className="text-gray-600 text-[10px] uppercase tracking-wider font-bold">Vazio</p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={scrollRef}
      className="flex-1 min-h-0 overflow-y-auto cyber-scrollbar px-3 pb-3"
      onScroll={handleScroll}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        {visibleCards.map((os, vi) => {
          const realIndex = startIndex + vi;
          const top = offsets[realIndex];

          return (
            <div
              key={os.id}
              ref={(el) => measureCard(os.id, el)}
              className="absolute left-0 right-0 mb-2"
              style={{ top, willChange: 'transform' }}
            >
              {/* Drop indicator above */}
              {draggedCard &&
               draggedCard.coluna_kanban === colunaId &&
               columnSortOrder === 'sequencia' &&
               dragOverPosition === realIndex &&
               dragOverColumn === colunaId && (
                <div
                  className="absolute -top-1 left-0 right-0 h-0.5 z-10"
                  style={{
                    background: `linear-gradient(90deg, transparent 0%, ${colunaColor} 50%, transparent 100%)`,
                    boxShadow: `0 0 8px ${colunaColor}`
                  }}
                />
              )}

              <KanbanCard
                os={os}
                colunaId={colunaId}
                colunaColor={colunaColor}
                textColor={textColor}
                badgeFilters={badgeFilters}
                mostrarInfoFinanceira={mostrarInfoFinanceira}
                searchMatchSource={searchMatchSource}
                isDragged={draggedCard?.id === os.id}
                onDragStart={onDragStart}
                onDragEnd={onDragEnd}
                onCardDragOver={onCardDragOver}
                onCardClick={onCardClick}
                onAnalise={onAnalise}
                onIniciarReparo={onIniciarReparo}
                onFecharOS={onFecharOS}
                onMoveOS={onMoveOS}
                onArchive={onArchive}
                allColunas={allColunas}
                rotas={rotas}
                index={realIndex}
              />

              {/* Drop indicator below last card */}
              {draggedCard &&
               draggedCard.coluna_kanban === colunaId &&
               columnSortOrder === 'sequencia' &&
               dragOverPosition === realIndex + 1 &&
               dragOverColumn === colunaId && (
                <div
                  className="absolute -bottom-1 left-0 right-0 h-0.5 z-10"
                  style={{
                    background: `linear-gradient(90deg, transparent 0%, ${colunaColor} 50%, transparent 100%)`,
                    boxShadow: `0 0 8px ${colunaColor}`
                  }}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Drop area at end */}
      {draggedCard && draggedCard.coluna_kanban === colunaId && columnSortOrder === 'sequencia' && cards.length > 0 && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onDrop={(e) => onDrop(e, colunaId)}
          className="h-8 rounded transition-all"
          style={{
            border: dragOverPosition === cards.length && dragOverColumn === colunaId
              ? `2px dashed ${colunaColor}`
              : '2px dashed transparent'
          }}
        />
      )}
    </div>
  );
}
