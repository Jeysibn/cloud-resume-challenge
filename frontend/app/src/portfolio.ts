import canonicalContent from "../../../content/portfolio.json";

export type ThemePreference = "light" | "dark";

export type ChatRole = "user" | "assistant";

export interface ChatSource {
  id: string;
  label: string;
  url: string;
}

export interface ChatMessage {
  role: ChatRole;
  content: string;
  sources?: ChatSource[];
  error?: boolean;
}

export interface SkillGroup {
  label: string;
  items: string[];
}

export interface ExperienceItem {
  role: string;
  organization: string;
  location: string;
  period: string;
  summary: string;
  highlights: string[];
}

export interface Project {
  id: string;
  slug: string;
  title: string;
  shortTitle: string;
  category: string;
  status: string;
  statusLabel: string;
  repositoryUrl: string;
  liveUrl?: string;
  preview: {
    summary: string;
    primaryOutcome: string;
    flow: {
      label: string;
      nodes: string[];
      accessible: string;
    };
    technologies: string[];
  };
  details: {
    summary: string;
    purpose: string;
    outcomes: string[];
    highlights: string[];
    technologies: string[];
    architectureFlows: Array<{
      label: string;
      nodes: string[];
    }>;
  };
  architecture: {
    diagrams: Array<{
      id: string;
      title: string;
      svg: string;
      description: string;
      summary: string[];
    }>;
  };
}

export interface Certification {
  name: string;
  issuer?: string;
  status: "earned" | "in-progress";
  referenceUrl?: string;
}

export const navigation = canonicalContent.navigation;
export const skillGroups = canonicalContent.skills as SkillGroup[];
export const experience = canonicalContent.experience as ExperienceItem[];
export const projects = canonicalContent.projects as Project[];
export const certifications = canonicalContent.certifications as Certification[];
export const education = canonicalContent.education;
export const profile = canonicalContent.profile;
export const career = canonicalContent.career;
export const professionalSummary = canonicalContent.career.professional_summary;
export const portfolioUrl = canonicalContent.profile.portfolio;
