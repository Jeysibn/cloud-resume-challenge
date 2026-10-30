import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { SiteFooter } from "./components/SiteChrome";
afterEach(()=>{cleanup();vi.unstubAllEnvs();});
it("shows counter without obsolete Azure claims",()=>{
 vi.stubEnv("VITE_API_BASE_URL",""); render(<SiteFooter/>);
 expect(screen.getByText(/Recorded visits/)).toBeInTheDocument();
 expect(screen.queryByText(/Azure|Terraform|API online/)).not.toBeInTheDocument();
});
