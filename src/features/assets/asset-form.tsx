"use client";

import { useState } from "react";
import { ActionForm } from "@/components/ui/action-form";
import { dateInput } from "@/lib/dates";
import { saveAsset } from "./actions";
import { assetTypes, conditions, parentOptions, type Asset, type Profile, type Site } from "./schema";

export function AssetForm({ asset, sites, assets, profiles, requestId }: {
  asset?: Asset; sites: Site[]; assets: Asset[]; profiles: Profile[]; requestId: string;
}) {
  const [siteId, setSiteId] = useState(asset?.site_id || sites[0]?.id || "");
  const parents = parentOptions(assets, siteId, asset?.id);
  return <ActionForm action={saveAsset} submitLabel={asset ? "Зберегти зміни" : "Створити об’єкт"}>
    <input type="hidden" name="request_id" value={requestId} />
    {asset && <><input type="hidden" name="id" value={asset.id} /><input type="hidden" name="updated_at" value={asset.updated_at} /></>}
    <div className="form-grid">
      <label className="field">Назва<input name="name" required maxLength={200} defaultValue={asset?.name} /></label>
      <label className="field">Тип<select name="type" defaultValue={asset?.type || "building"}>
        {Object.entries(assetTypes).map(([code, label]) => <option key={code} value={code}>{label}</option>)}
      </select></label>
      <label className="field">Територія<select name="site_id" required value={siteId} onChange={(event) => setSiteId(event.target.value)}>
        {!sites.length && <option value="">Спочатку створіть територію</option>}
        {sites.map((site) => <option key={site.id} value={site.id}>{site.name}</option>)}
      </select></label>
      <label className="field">Батьківський об’єкт<select key={siteId} name="parent_id" defaultValue={asset?.site_id === siteId ? asset.parent_id || "" : ""}>
        <option value="">Без батьківського об’єкта</option>
        {parents.map((parent) => <option key={parent.id} value={parent.id}>{parent.name} · {parent.id.slice(0, 8)}</option>)}
      </select></label>
      <label className="field">Технічний стан<select name="condition" defaultValue={asset?.condition || "unknown"}>
        {Object.entries(conditions).map(([code, label]) => <option key={code} value={code}>{label}</option>)}
      </select></label>
      <label className="field">Відповідальний<select name="responsible_id" defaultValue={asset?.responsible_id || ""}>
        <option value="">Не призначено</option>
        {asset?.responsible_id && !profiles.some((profile) => profile.id === asset.responsible_id) &&
          <option value={asset.responsible_id}>Неактивний користувач — оберіть іншого</option>}
        {profiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.display_name || profile.id}</option>)}
      </select></label>
      <label className="field">Наступний огляд<input type="date" name="next_inspection_date" defaultValue={dateInput(asset?.next_inspection_at || null)} /></label>
      <label className="field">Адреса або розташування<input name="location_description" maxLength={1000} defaultValue={asset?.location_description} /></label>
    </div>
    <label className="field">Опис<textarea name="description" maxLength={5000} defaultValue={asset?.description} /></label>
    {assets.length >= 1000 && <p className="notice">Список батьківських об’єктів обмежено першою тисячею записів.</p>}
  </ActionForm>;
}
