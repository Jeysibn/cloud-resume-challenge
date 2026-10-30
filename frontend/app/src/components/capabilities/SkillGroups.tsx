import type { SkillGroup } from "../../portfolio";
import { skillGroups } from "../../portfolio";

export interface SkillSelection {
  group: SkillGroup;
  item?: string;
}

export function SkillGroups({
  onOpen,
}: {
  onOpen: (selection: SkillSelection) => void;
}) {
  return (
    <div className="skill-groups">
      {skillGroups.map((group, index) => {
        const headingId = `skill-group-${index + 1}`;
        return (
          <section className="skill-group" key={group.label} aria-labelledby={headingId}>
            <h3 id={headingId}>{group.label}</h3>
            <ul>
              {group.items.map((item) => (
                <li key={item}>
                  <button
                    className="skill-chip"
                    type="button"
                    onClick={() => onOpen({ group, item })}
                    aria-label={`${item} — inspect ${group.label}`}
                  >
                    {item}
                  </button>
                </li>
              ))}
            </ul>
            <button
              className="skill-group-more"
              type="button"
              onClick={() => onOpen({ group })}
              aria-label={`Group details: ${group.label}`}
            >
              Group details
            </button>
          </section>
        );
      })}
    </div>
  );
}
