import type { ReactNode } from "react";
import { Icon } from "./Icons";

const provenanceLabels = {
  uci: "UCI 실험 데이터",
  virtual: "가상 설비",
  label: "실험 상태 라벨",
  simulation: "가상 시나리오",
  education: "교육용 열화 표현",
} as const;

export type ProvenanceKind = keyof typeof provenanceLabels;

export function ProvenanceTag({ kind }: { kind: ProvenanceKind }) {
  return <span className={`provenance-tag provenance-${kind}`}>{provenanceLabels[kind]}</span>;
}

export function TermHelp({ term, children }: { term: string; children: ReactNode }) {
  return (
    <span className="term-help">
      <span>{term}</span>
      <details>
        <summary aria-label={`${term} 설명 보기`}>
          <Icon name="info" size={14} />
        </summary>
        <span className="term-help-popover" role="note">
          {children}
        </span>
      </details>
    </span>
  );
}
