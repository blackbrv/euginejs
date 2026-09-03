import { PACKAGES } from "@/lib/packages";

/** Renders the shared package list (see src/lib/packages.ts) as a table, for use in MDX. */
export function PackageTable() {
  return (
    <div className="overflow-x-auto">
      <table>
        <thead>
          <tr>
            <th>Package</th>
            <th>What it is</th>
          </tr>
        </thead>
        <tbody>
          {PACKAGES.map((pkg) => (
            <tr key={pkg.name}>
              <td>
                <code>{pkg.name}</code>
              </td>
              <td>{pkg.desc}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
