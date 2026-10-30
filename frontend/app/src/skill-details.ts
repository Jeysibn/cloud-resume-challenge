export type SkillDetail = {
  summary: string;
  practice: string;
  itemDescriptions: Record<string, string>;
};

export const skillDetails: Record<string, SkillDetail> = {
  "Cloud & virtualization": {
    summary: "Cloud platforms and virtualization are where I practice provisioning, networking, identity, cost-aware architecture, and reproducible environments.",
    practice: "This group connects directly to the Azure-backed portfolio, AWS troubleshooting environments, OCI foundations, and the Proxmox/VMware lab work behind my infrastructure practice.",
    itemDescriptions: {
      Azure: "Serverless application hosting, monitoring, storage, identity, and infrastructure automation for the portfolio platform.",
      AWS: "EC2, VPC, subnets, routing, and security groups used to reproduce and troubleshoot customer scenarios.",
      "Oracle Cloud Infrastructure": "Cloud foundations covering core OCI services, architecture, security, pricing, and operational concepts.",
      "VMware vSphere": "Virtualization fundamentals used in enterprise infrastructure training and lab-based systems administration.",
      Proxmox: "Homelab virtualization platform used as the infrastructure layer for automated Kubernetes node provisioning.",
    },
  },
  "Containers & orchestration": {
    summary: "I use containers to make workloads portable and orchestration to turn deployment, scheduling, and recovery into repeatable platform behavior.",
    practice: "My main hands-on environment is a k3s homelab where application state, Helm configuration, and cluster operations are managed declaratively.",
    itemDescriptions: {
      "Kubernetes (k3s)": "Lightweight Kubernetes used for a single-node homelab environment, declarative deployment, service operation, and GitOps practice.",
      Docker: "Container packaging and local runtime workflows for keeping application dependencies consistent across environments.",
      Helm: "Templating and release configuration for Kubernetes workloads, including CI rendering and validation before deployment.",
    },
  },
  "Infrastructure & delivery": {
    summary: "This is the automation layer: infrastructure as code, version-controlled delivery, GitOps reconciliation, and repeatable configuration.",
    practice: "Terraform and GitHub Actions are central to the portfolio deployment path, while Argo CD and Helm drive the declarative delivery model in the homelab.",
    itemDescriptions: {
      Terraform: "Infrastructure as code for provisioning and reviewing cloud and homelab resources through version-controlled changes.",
      "GitHub Actions": "CI/CD workflows for typechecking, testing, Terraform validation, deployment, OIDC authentication, and smoke verification.",
      "Argo CD": "GitOps reconciliation for keeping Kubernetes application state aligned with the desired configuration stored in Git.",
      Git: "Source control foundation for code review, branching, infrastructure changes, and deployment history.",
      YAML: "Configuration format used across CI/CD workflows, Kubernetes manifests, Helm values, and automation definitions.",
    },
  },
  Observability: {
    summary: "Observability gives me evidence before assumptions: health signals, logs, metrics, dashboards, and operational context for troubleshooting.",
    practice: "The Azure portfolio uses Application Insights and Log Analytics, while the Kubernetes homelab uses Prometheus and Grafana for infrastructure and workload visibility.",
    itemDescriptions: {
      "Azure Application Insights": "Application telemetry for requests, failures, latency, exceptions, and production behavior in the serverless portfolio.",
      "Log Analytics": "Centralized Azure log querying and retention used alongside Application Insights for operational investigation.",
      Prometheus: "Metrics collection for Kubernetes and workload monitoring in the homelab environment.",
      Grafana: "Dashboards and visualization for turning collected metrics into useful operational views.",
    },
  },
  "Systems & networking": {
    summary: "Reliable cloud work still depends on strong systems and networking fundamentals: operating systems, identity, name resolution, connectivity, and remote administration.",
    practice: "These skills come from enterprise support, helpdesk work, cloud scenario reproduction, and hands-on lab administration across Windows and Linux environments.",
    itemDescriptions: {
      Linux: "Command-line administration, service troubleshooting, scripting, networking, and server operations across cloud and lab environments.",
      "Windows Server": "Server administration fundamentals used in enterprise training and support-oriented infrastructure work.",
      "Active Directory": "Account, access, and identity administration experience from enterprise helpdesk operations.",
      "TCP/IP": "Core networking model used when diagnosing connectivity, routing, addressing, and application communication issues.",
      DNS: "Name-resolution troubleshooting and configuration across cloud, enterprise, and homelab environments.",
      VPN: "Remote connectivity troubleshooting with attention to routing, access, and endpoint configuration.",
      SSH: "Secure remote administration for Linux hosts, cloud instances, and homelab systems.",
      RDP: "Remote Windows administration and troubleshooting for endpoint and server environments.",
    },
  },
  "Scripting, security & tools": {
    summary: "These tools support the operational work around the platform: automation, troubleshooting, security operations, case management, and repeatable support workflows.",
    practice: "Python and shell scripting support automation, while Trend Vision One, Jira, and ITIL practices connect the technical work to structured enterprise operations.",
    itemDescriptions: {
      Python: "Backend and automation language used for Azure Functions and practical scripting tasks.",
      Bash: "Linux shell automation for repeatable administration, validation, and developer workflows.",
      PowerShell: "Windows-focused scripting and administration for systems and support workflows.",
      "Trend Vision One": "Enterprise security platform experience from endpoint-security SaaS technical support and workload-protection training.",
      Jira: "Issue and case workflow tracking used to organize technical investigation and communication.",
      ITIL: "Service-management concepts that support structured incident handling, documentation, and operational ownership.",
    },
  },
};
