import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { SiteFooter } from "./components/SiteChrome";
afterEach(()=>{cleanup();vi.unstubAllEnvs();});
it("keeps visitor counting out of the footer",()=>{
 vi.stubEnv("VITE_API_BASE_URL",""); render(<SiteFooter/>);
 expect(screen.queryByText(/Recorded visits/)).not.toBeInTheDocument();
 expect(screen.queryByText(/Azure|Terraform|API online/)).not.toBeInTheDocument();
});
