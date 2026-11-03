import { roleCodes, roleLabels } from "@/lib/auth/validation";

export function RoleFields({ selected = [] }: { selected?: string[] }) {
  return <fieldset className="stack">
    <legend>Ролі (можна суміщати)</legend>
    {roleCodes.map((role) => <label key={role}>
      <input type="checkbox" name="roles" value={role} defaultChecked={selected.includes(role)} /> {roleLabels[role]}
    </label>)}
  </fieldset>;
}