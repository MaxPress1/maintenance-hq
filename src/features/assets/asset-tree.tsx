import Link from "next/link";
import { conditions, type Asset } from "./schema";

export function AssetTree({ assets }: { assets: Asset[] }) {
  const ids = new Set(assets.map((asset) => asset.id));
  const children = new Map<string | null, Asset[]>();
  for (const asset of assets) {
    const parent = asset.parent_id && ids.has(asset.parent_id) ? asset.parent_id : null;
    children.set(parent, [...(children.get(parent) || []), asset]);
  }
  function branch(parent: string | null, visited: Set<string>): React.ReactNode {
    return <ul className="tree">{(children.get(parent) || []).filter((asset) => !visited.has(asset.id)).map((asset) =>
      <li key={asset.id}><Link href={`/assets/${asset.id}`}>{asset.name}</Link> <span className={`pill ${asset.condition === "critical" ? "critical" : ""}`}>{conditions[asset.condition]}</span>
        {children.has(asset.id) && branch(asset.id, new Set([...visited, asset.id]))}</li>)}</ul>;
  }
  return branch(null, new Set());
}
