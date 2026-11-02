import type { CSSProperties } from "react";
import type { SkillGroup } from "../../portfolio";
import { skillGroups } from "../../portfolio";
import { SKILL_SPRITE, markFor } from "./skillMarks";

export interface SkillSelection {
  group: SkillGroup;
  item?: string;
}

/*
 * The toolkit is drawn as a platform stack: four layers read bottom-up from
 * foundations to delivery, with two cross-cutting pillars that span every
 * layer. Placement is presentation only; the canonical groups are unchanged,
 * and any group not named here becomes an extra layer at the top.
 */
const LAYERS_TOP_DOWN = [
  "Infrastructure & delivery",
  "Containers & orchestration",
  "Cloud & virtualization",
  "Systems & networking",
];
const PILLAR_START = "Scripting, security & tools";
const PILLAR_END = "Observability";

function SkillMark({ skill }: { skill: string }) {
  const mark = markFor(skill);
  if (mark.kind === "type") {
    return (
      <span className="skill-mark skill-mark-type" aria-hidden="true">
        {mark.text}
      </span>
    );
  }
  return (
    <svg className="skill-mark" aria-hidden="true" focusable="false">
      <use href={`${SKILL_SPRITE}#${mark.id}`} />
    </svg>
  );
}

function Group({
  group,
  index,
  variant,
  level,
  onOpen,
}: {
  group: SkillGroup;
  index: number;
  variant: "layer" | "pillar";
  level?: number;
  onOpen: (selection: SkillSelection) => void;
}) {
  const headingId = `skill-group-${index + 1}`;
  return (
    <section
      className={`skill-group skill-${variant}`}
      aria-labelledby={headingId}
      style={level ? ({ "--depth": level } as CSSProperties) : undefined}
    >
      <header className="skill-group-head">
        <p className="skill-group-place">{variant === "layer" ? `Layer ${level}` : "Across every layer"}</p>
        <h3 id={headingId}>{group.label}</h3>
        <button
          className="skill-group-more"
          type="button"
          onClick={() => onOpen({ group })}
          aria-label={`Group details: ${group.label}`}
        >
          Details
        </button>
      </header>
      <ul className="skill-tiles">
        {group.items.map((item) => {
          const mark = markFor(item);
          return (
            <li key={item}>
              <button
                className="skill-chip"
                type="button"
                onClick={() => onOpen({ group, item })}
                aria-label={`${item} — inspect ${group.label}`}
                style={mark.kind === "logo" ? ({ "--brand": mark.hex } as CSSProperties) : undefined}
              >
                <SkillMark skill={item} />
                <span>{item}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function SkillGroups({
  onOpen,
}: {
  onOpen: (selection: SkillSelection) => void;
}) {
  const indexOf = (group: SkillGroup) => skillGroups.indexOf(group);
  const byLabel = (label: string) => skillGroups.find((group) => group.label === label);
  const start = byLabel(PILLAR_START);
  const end = byLabel(PILLAR_END);
  const named = LAYERS_TOP_DOWN.map(byLabel).filter((group): group is SkillGroup => Boolean(group));
  const extra = skillGroups.filter((group) => group !== start && group !== end && !named.includes(group));
  const layers = [...extra, ...named];

  return (
    <div className="skill-stack">
      {start && <Group group={start} index={indexOf(start)} variant="pillar" onOpen={onOpen} />}
      <div className="skill-layers">
        {layers.map((group, position) => (
          <Group
            key={group.label}
            group={group}
            index={indexOf(group)}
            variant="layer"
            level={layers.length - position}
            onOpen={onOpen}
          />
        ))}
      </div>
      {end && <Group group={end} index={indexOf(end)} variant="pillar" onOpen={onOpen} />}
    </div>
  );
}
