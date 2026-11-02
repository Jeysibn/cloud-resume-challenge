/*
 * Logos for the Toolkit stack, drawn from the static sprite public/skill-icons.svg
 * (one cached file, so no path data ships in the JavaScript bundle).
 *
 * - Most paths come from Simple Icons (CC0-1.0, https://simpleicons.org).
 * - Simple Icons no longer ships the AWS, Microsoft, Oracle and VMware vSphere
 *   marks; AWS, Azure, Windows, PowerShell and vSphere come from Devicon
 *   "plain" icons (MIT, https://github.com/devicons/devicon). The Oracle ring
 *   is drawn for this site.
 * - Protocols and practices have no logo, so they get a typeset mark instead.
 *
 * Logos are trademarks of their owners and are used only to name the tools.
 * To add one: add a <symbol id> to the sprite, then map the skill here.
 */
export type SkillMark = { kind: "logo"; id: string; hex: string } | { kind: "type"; text: string };

const logo = (id: string, hex: string): SkillMark => ({ kind: "logo", id, hex });
const type = (text: string): SkillMark => ({ kind: "type", text });

export const SKILL_SPRITE = `${import.meta.env.BASE_URL}skill-icons.svg`;

export const skillMarks: Record<string, SkillMark> = {
  AWS: logo("aws", "#FF9900"),
  Azure: logo("azure", "#0078D4"),
  "Oracle Cloud Infrastructure": logo("oracle", "#C74634"),
  "VMware vSphere": logo("vmware-vsphere", "#0091DA"),
  Proxmox: logo("proxmox", "#E57000"),
  "Kubernetes (k3s)": logo("kubernetes-k3s", "#326CE5"),
  Docker: logo("docker", "#2496ED"),
  Helm: logo("helm", "#0F1689"),
  Terraform: logo("terraform", "#844FBA"),
  "GitHub Actions": logo("github-actions", "#2088FF"),
  "Argo CD": logo("argo-cd", "#EF7B4D"),
  Git: logo("git", "#F03C2E"),
  YAML: logo("yaml", "#CB171E"),
  "Azure Application Insights": logo("azure", "#0078D4"),
  "Log Analytics": logo("azure", "#0078D4"),
  Prometheus: logo("prometheus", "#E6522C"),
  Grafana: logo("grafana", "#F46800"),
  Linux: logo("linux", "#FCC624"),
  "Windows Server": logo("windows", "#0078D4"),
  "Active Directory": type("AD"),
  "TCP/IP": type("TCP"),
  DNS: type("DNS"),
  VPN: type("VPN"),
  SSH: type("SSH"),
  RDP: type("RDP"),
  Python: logo("python", "#3776AB"),
  Bash: logo("bash", "#4EAA25"),
  PowerShell: logo("powershell", "#5391FE"),
  "Trend Vision One": logo("trend-vision-one", "#D71921"),
  Jira: logo("jira", "#0052CC"),
  ITIL: type("ITIL"),
};

/** Certification issuers drawn from the same sprite (GitHub and HashiCorp from Simple Icons). */
export const issuerMarks: Record<string, string> = {
  Oracle: "oracle",
  "Trend Micro": "trend-vision-one",
  GitHub: "github",
  HashiCorp: "hashicorp",
};

/** Fallback for a skill added to the content later without a mark. */
export function markFor(skill: string): SkillMark {
  return skillMarks[skill] ?? type(skill.replace(/[^A-Za-z0-9]/g, "").slice(0, 3).toUpperCase());
}
