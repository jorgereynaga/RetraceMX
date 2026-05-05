import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { api } from "../api/resources";
import type { CollectionCenter, Material, Party, PriceList, PriceListItem } from "../types";
import { Page } from "../components/Page";
import { Pagination } from "../components/Pagination";
import { SortableHeader } from "../components/SortableHeader";
import { matchesSearch, paginate } from "../utils/listing";
import { sortByValue } from "../utils/listing";
import { useAuth } from "../context/AuthContext";
import { userCan } from "../utils/permissions";

function emptyListForm() {
  return {
    code: "",
    collection_center: "",
    linked_party: "",
    currency: "MXN",
    valid_from: "",
    valid_to: "",
    is_active: true,
  };
}

function emptyItemForm(priceListId = "") {
  return {
    price_list: priceListId,
    material: "",
    unit_price: "",
    is_active: true,
  };
}

function centerLabel(center: CollectionCenter | undefined) {
  if (!center) return "-";
  const kind = center.kind === "smelter" ? "Fundidora" : center.kind === "destination" ? "Destino" : "Acopio";
  return `${center.code} · ${center.name} · ${kind}`;
}

function materialLabel(material: Material | undefined) {
  if (!material) return "-";
  return `${material.code} · ${material.name}`;
}

function partyLabel(party: Party | undefined) {
  if (!party) return "Lista general";
  return party.trade_name || party.legal_name || "Persona/empresa";
}

function buildPriceListName(code: string, linkedPartyId: string, partyById: Record<string, Party>) {
  const label = partyLabel(partyById[linkedPartyId]);
  return code ? `${code} · ${label}` : label;
}

export function PriceListsPage() {
  const { user } = useAuth();
  const canManagePriceLists = userCan(user, "price-lists.manage");
  const [priceLists, setPriceLists] = useState<PriceList[]>([]);
  const [items, setItems] = useState<PriceListItem[]>([]);
  const [centers, setCenters] = useState<CollectionCenter[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [selectedListId, setSelectedListId] = useState("");
  const [selectedItemId, setSelectedItemId] = useState("");
  const [listForm, setListForm] = useState(emptyListForm());
  const [itemForm, setItemForm] = useState(emptyItemForm());
  const [duplicatePartyId, setDuplicatePartyId] = useState("");
  const [duplicateCode, setDuplicateCode] = useState("");
  const [materialSearch, setMaterialSearch] = useState("");
  const [listSearch, setListSearch] = useState("");
  const [listPage, setListPage] = useState(1);
  const [listPageSize, setListPageSize] = useState(10);
  const [listSortKey, setListSortKey] = useState<"code" | "center" | "currency" | "valid_from" | "active">("code");
  const [listSortDirection, setListSortDirection] = useState<"asc" | "desc">("asc");
  const [message, setMessage] = useState<string | null>(null);
  const [pendingSelectedListId, setPendingSelectedListId] = useState<string | null>(null);
  const itemFormRef = useRef<HTMLFormElement | null>(null);

  async function refresh() {
    setPriceLists(await api.priceLists().catch(() => []));
    setItems(await api.priceListItems().catch(() => []));
    setCenters(await api.centers().catch(() => []));
    setMaterials(await api.materials().catch(() => []));
    setParties(await api.parties().catch(() => []));
  }

  useEffect(() => {
    refresh();
  }, []);

  const selectedList = useMemo(() => priceLists.find((priceList) => priceList.id === selectedListId) ?? null, [priceLists, selectedListId]);
  const selectedItem = useMemo(() => items.find((item) => item.id === selectedItemId) ?? null, [items, selectedItemId]);
  const centerById = useMemo(() => Object.fromEntries(centers.map((center) => [center.id, center])), [centers]);
  const materialById = useMemo(() => Object.fromEntries(materials.map((material) => [material.id, material])), [materials]);
  const partyById = useMemo(() => Object.fromEntries(parties.map((party) => [party.id, party])), [parties]);
  const linkedPartyIds = useMemo(() => new Set(priceLists.map((priceList) => priceList.linked_party).filter(Boolean) as string[]), [priceLists]);
  const availablePartiesForForm = useMemo(
    () => parties.filter((party) => !linkedPartyIds.has(party.id) || party.id === (selectedList?.linked_party ?? "")),
    [linkedPartyIds, parties, selectedList?.linked_party],
  );
  const availablePartiesForDuplicate = useMemo(
    () => parties.filter((party) => !linkedPartyIds.has(party.id)),
    [linkedPartyIds, parties],
  );
  const selectedListPartyLabel = useMemo(() => {
    if (!selectedList?.linked_party) return "Lista general del centro";
    const party = partyById[selectedList.linked_party];
    return partyLabel(party) || selectedList.linked_party_name || "Persona/empresa";
  }, [partyById, selectedList?.linked_party, selectedList?.linked_party_name]);
  const selectedListPartyConflict = useMemo(() => {
    if (!listForm.linked_party) return null;
    return priceLists.find((priceList) => priceList.linked_party === listForm.linked_party && priceList.id !== selectedList?.id) ?? null;
  }, [listForm.linked_party, priceLists, selectedList?.id]);
  const duplicatePartyConflict = useMemo(() => {
    if (!duplicatePartyId) return null;
    return priceLists.find((priceList) => priceList.linked_party === duplicatePartyId) ?? null;
  }, [duplicatePartyId, priceLists]);
  const selectedPriceListItems = useMemo(() => items.filter((item) => item.price_list === selectedListId), [items, selectedListId]);
  const selectedListDisplayName = useMemo(
    () => (selectedList ? buildPriceListName(selectedList.code, selectedList.linked_party ?? "", partyById) : ""),
    [partyById, selectedList],
  );
  const filteredMaterials = useMemo(() => {
    const value = materialSearch.trim().toLowerCase();
    return materials.filter((material) => {
      const isAlreadyInSelectedList =
        selectedPriceListItems.some((item) => item.material === material.id && item.id !== selectedItem?.id);
      if (isAlreadyInSelectedList && material.id !== itemForm.material) return false;
      if (!value) return true;
      return [material.code, material.name].join(" ").toLowerCase().includes(value);
    });
  }, [itemForm.material, materialSearch, materials, selectedItem?.id, selectedPriceListItems]);
  const selectedListItemCount = selectedPriceListItems.length;
  const selectedListActiveItemCount = useMemo(
    () => selectedPriceListItems.filter((item) => item.is_active).length,
    [selectedPriceListItems],
  );
  const linkedPriceListCount = useMemo(() => priceLists.filter((priceList) => priceList.linked_party).length, [priceLists]);
  const currentItemPriceListId = selectedListId || itemForm.price_list;
  const selectedItemAlreadyExists = useMemo(() => {
    if (!itemForm.material) return false;
    return selectedPriceListItems.some((item) => item.material === itemForm.material && item.id !== selectedItem?.id);
  }, [itemForm.material, selectedItem?.id, selectedPriceListItems]);
  const canSubmitItem = !!currentItemPriceListId && !!itemForm.material && !!itemForm.unit_price && !selectedItemAlreadyExists;
  const filteredPriceLists = useMemo(
    () =>
      priceLists.filter((priceList) =>
        matchesSearch(
          [
            priceList.code,
            priceList.name,
            priceList.currency,
            priceList.valid_from,
            priceList.valid_to,
            centerById[priceList.collection_center]?.name ?? priceList.collection_center,
            partyById[priceList.linked_party ?? ""]?.trade_name ?? partyById[priceList.linked_party ?? ""]?.legal_name ?? priceList.linked_party_name ?? "",
          ],
          listSearch,
        ),
      ),
    [centerById, listSearch, partyById, priceLists],
  );
  const sortedPriceLists = useMemo(() => {
    const accessors = {
      code: (priceList: PriceList) => priceList.code,
      center: (priceList: PriceList) => centerById[priceList.collection_center]?.name ?? priceList.collection_center,
      currency: (priceList: PriceList) => priceList.currency,
      valid_from: (priceList: PriceList) => priceList.valid_from,
      active: (priceList: PriceList) => (priceList.is_active ? 1 : 0),
    } satisfies Record<typeof listSortKey, (priceList: PriceList) => string | number>;
    return sortByValue(filteredPriceLists, accessors[listSortKey], listSortDirection);
  }, [centerById, filteredPriceLists, listSortDirection, listSortKey]);
  const paginatedPriceLists = useMemo(() => paginate(sortedPriceLists, listPage, listPageSize), [listPage, listPageSize, sortedPriceLists]);

  useEffect(() => {
    const value = materialSearch.trim().toLowerCase();
    if (!value) return;

    const exactMatch = filteredMaterials.find((material) => {
      const code = material.code.toLowerCase();
      const name = material.name.toLowerCase();
      return code === value || name === value;
    });

    if (exactMatch && exactMatch.id !== itemForm.material) {
      setItemForm((current) => ({ ...current, material: exactMatch.id }));
      return;
    }

    if (filteredMaterials.length === 1 && filteredMaterials[0].id !== itemForm.material) {
      setItemForm((current) => ({ ...current, material: filteredMaterials[0].id }));
    }
  }, [filteredMaterials, itemForm.material, materialSearch]);

  useEffect(() => {
    if (selectedList) {
      setListForm({
        code: selectedList.code,
        collection_center: selectedList.collection_center,
        linked_party: selectedList.linked_party ?? "",
        currency: selectedList.currency,
        valid_from: selectedList.valid_from,
        valid_to: selectedList.valid_to ?? "",
        is_active: selectedList.is_active,
      });
      setItemForm(emptyItemForm(selectedList.id));
      setDuplicatePartyId(selectedList.linked_party ?? "");
      setDuplicateCode(`${selectedList.code}-copia`);
    } else {
      setListForm(emptyListForm());
      setItemForm(emptyItemForm());
      setDuplicatePartyId("");
      setDuplicateCode("");
    }
  }, [selectedList]);

  useEffect(() => {
    if (selectedItem) {
      setItemForm({
        price_list: selectedItem.price_list,
        material: selectedItem.material,
        unit_price: selectedItem.unit_price,
        is_active: selectedItem.is_active,
      });
      setSelectedListId(selectedItem.price_list);
    }
  }, [selectedItem]);

  useEffect(() => {
    if (selectedItemId && itemFormRef.current) {
      itemFormRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [selectedItemId]);

  useEffect(() => {
    if (!pendingSelectedListId) return;
    if (!priceLists.some((priceList) => priceList.id === pendingSelectedListId)) return;
    setSelectedListId(pendingSelectedListId);
    setPendingSelectedListId(null);
  }, [pendingSelectedListId, priceLists]);

  useEffect(() => {
    setListPage(1);
  }, [listSearch]);

  useEffect(() => {
    setListPage(1);
  }, [listPageSize]);

  useEffect(() => {
    setListPage(1);
  }, [listSortDirection, listSortKey]);

  function toggleListSort(nextKey: typeof listSortKey) {
    if (nextKey === listSortKey) {
      setListSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setListSortKey(nextKey);
    setListSortDirection("asc");
  }

  function updateListField(field: keyof typeof listForm, value: string | boolean) {
    setListForm((current) => ({ ...current, [field]: value }));
  }

  function updateItemField(field: keyof typeof itemForm, value: string | boolean) {
    setItemForm((current) => ({ ...current, [field]: value }));
  }

  function startNewList() {
    setSelectedListId("");
    setSelectedItemId("");
    setListForm(emptyListForm());
    setItemForm(emptyItemForm());
    setPendingSelectedListId(null);
  }

  function startNewItem() {
    setSelectedItemId("");
    setItemForm(emptyItemForm(selectedListId || itemForm.price_list));
  }

  async function handleListSubmit(event: FormEvent) {
    event.preventDefault();
    if (!canManagePriceLists) {
      setMessage("No tienes permiso para gestionar listas de precios.");
      return;
    }
    setMessage(null);
    try {
      const payload = {
        code: listForm.code,
        name: buildPriceListName(listForm.code, listForm.linked_party, partyById),
        collection_center: listForm.collection_center,
        linked_party: listForm.linked_party || null,
        currency: listForm.currency,
        valid_from: listForm.valid_from,
        valid_to: listForm.valid_to || null,
        is_active: listForm.is_active,
      };
      if (selectedList) {
        const updated = await api.priceListUpdate(selectedList.id, payload);
        setSelectedListId(updated.id);
        setMessage("Lista de precios actualizada.");
      } else {
        const created = await api.priceListCreate(payload);
        setSelectedListId(created.id);
        setPendingSelectedListId(created.id);
        setMessage("Lista de precios creada.");
      }
      setSelectedItemId("");
      setListForm(emptyListForm());
      setItemForm(emptyItemForm());
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo guardar la lista");
    }
  }

  async function removeList() {
    if (!selectedList) return;
    if (!canManagePriceLists) {
      setMessage("No tienes permiso para eliminar listas de precios.");
      return;
    }
    if (!window.confirm(`¿Seguro que deseas eliminar la lista ${selectedListDisplayName}? Esta acción no se puede deshacer.`)) {
      return;
    }
    setMessage(null);
    try {
      await api.priceListDelete(selectedList.id);
      setMessage("Lista de precios eliminada.");
      setSelectedListId("");
      setSelectedItemId("");
      setListForm(emptyListForm());
      setItemForm(emptyItemForm());
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo eliminar la lista");
    }
  }

  async function handleDuplicateList() {
    if (!selectedList) return;
    if (!canManagePriceLists) {
      setMessage("No tienes permiso para duplicar listas de precios.");
      return;
    }
    if (!duplicatePartyId) {
      setMessage("Selecciona la persona/empresa a la que quedará enlazada la copia.");
      return;
    }
    if (duplicatePartyConflict) {
      setMessage("Ese cliente/empresa ya tiene una lista de precios asignada.");
      return;
    }
    setMessage(null);
    try {
      const created = await api.priceListDuplicate(selectedList.id, {
        linked_party_id: duplicatePartyId,
        code: duplicateCode || undefined,
        name: buildPriceListName(duplicateCode || `${selectedList.code}-copia`, duplicatePartyId, partyById),
      });
      setSelectedListId(created.id);
      setPendingSelectedListId(created.id);
      setSelectedItemId("");
      setItemForm(emptyItemForm(created.id));
      setMessage("Lista duplicada y enlazada correctamente.");
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo duplicar la lista");
    }
  }

  async function handleItemSubmit(event: FormEvent) {
    event.preventDefault();
    if (!canManagePriceLists) {
      setMessage("No tienes permiso para gestionar partidas de precios.");
      return;
    }
    setMessage(null);
    try {
      const payload = {
        price_list: selectedListId || itemForm.price_list,
        material: itemForm.material,
        unit_price: itemForm.unit_price,
        is_active: itemForm.is_active,
      };
      if (selectedItem) {
        await api.priceListItemUpdate(selectedItem.id, payload);
        setMessage("Partida de lista actualizada.");
      } else {
        await api.priceListItemCreate(payload);
        setMessage("Partida de lista creada.");
      }
      setSelectedItemId("");
      setItemForm(emptyItemForm(selectedListId || itemForm.price_list));
      await refresh();
    } catch (error) {
      const messageText = error instanceof Error ? error.message : "No se pudo guardar la partida";
      if (messageText.includes("conjunto único") || messageText.toLowerCase().includes("unique")) {
        setMessage("Ese material ya existe en la lista seleccionada.");
      } else {
        setMessage(messageText);
      }
    }
  }

  async function removeItem() {
    if (!selectedItem) return;
    if (!canManagePriceLists) {
      setMessage("No tienes permiso para eliminar partidas de precios.");
      return;
    }
    if (!window.confirm("¿Seguro que deseas eliminar esta partida de precio? Esta acción no se puede deshacer.")) {
      return;
    }
    setMessage(null);
    try {
      await api.priceListItemDelete(selectedItem.id);
      setMessage("Partida eliminada.");
      setSelectedItemId("");
      setItemForm(emptyItemForm(selectedListId || selectedItem.price_list));
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo eliminar la partida");
    }
  }

  return (
    <Page title="Listas de precios" actions={<span className="muted">Precios por centro y material valorizable</span>}>
      {message ? <div className="info-banner" style={{ marginBottom: 16 }}>{message}</div> : null}

      <section className="metric-panel" style={{ marginBottom: 16 }}>
        <div className="muted" style={{ marginBottom: 10, fontSize: "0.9rem" }}>
          Crea listas por centro, enlázalas a una persona o empresa y duplica también sus materiales cuando necesites reutilizar una estructura comercial.
        </div>
        <div className="grid" style={{ gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 12 }}>
          <div className="metric-card">
            <span>Total de listas</span>
            <strong>{priceLists.length}</strong>
          </div>
          <div className="metric-card">
            <span>Listas enlazadas</span>
            <strong>{linkedPriceListCount}</strong>
          </div>
          <div className="metric-card">
            <span>Materiales en selección</span>
            <strong>{selectedListItemCount}</strong>
          </div>
          <div className="metric-card">
            <span>Activas en selección</span>
            <strong>{selectedListActiveItemCount}</strong>
          </div>
        </div>
      </section>

        <div className="metric-panel" style={{ marginBottom: 12 }}>
          <label className="search-box">
            Búsqueda rápida en listas
            <input
              value={listSearch}
              onChange={(e) => setListSearch(e.target.value)}
              placeholder="Buscar por código, lista, centro, moneda o vigencia"
            />
          </label>
        </div>

        <section className="metric-panel">
          <h3 style={{ marginTop: 0 }}>Listas guardadas</h3>
          <table className="table">
            <thead>
          <tr>
                <th><SortableHeader label="Código" active={listSortKey === "code"} direction={listSortDirection} onClick={() => toggleListSort("code")} /></th>
                <th><SortableHeader label="Centro" active={listSortKey === "center"} direction={listSortDirection} onClick={() => toggleListSort("center")} /></th>
                <th>Persona / empresa</th>
                <th><SortableHeader label="Activa" active={listSortKey === "active"} direction={listSortDirection} onClick={() => toggleListSort("active")} /></th>
              </tr>
            </thead>
            <tbody>
              {paginatedPriceLists.items.map((priceList) => (
                <tr
                  key={priceList.id}
                  onClick={() => setSelectedListId(priceList.id)}
                  style={{ cursor: "pointer", background: priceList.id === selectedListId ? "rgba(124, 58, 237, 0.12)" : undefined }}
                >
                  <td>{priceList.code}</td>
                  <td>{centerLabel(centerById[priceList.collection_center])}</td>
                  <td>{partyById[priceList.linked_party ?? ""]?.trade_name ?? partyById[priceList.linked_party ?? ""]?.legal_name ?? priceList.linked_party_name ?? "Lista general"}</td>
                  <td>{priceList.is_active ? "Sí" : "No"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pagination
            {...paginatedPriceLists}
            onPageChange={setListPage}
            pageSize={listPageSize}
            onPageSizeChange={setListPageSize}
          />
        </section>

      <section className="metric-panel" style={{ marginBottom: 18 }}>
        <div className="section-header">
          <div>
            <h3 style={{ margin: 0 }}>Lista de precios</h3>
            <div className="muted" style={{ marginTop: 4 }}>
              Formulario para crear o editar la lista completa.
            </div>
          </div>
        </div>
        <form className="inline-form compact-form price-list-form" onSubmit={handleListSubmit}>
          <label>
            Código
            <input value={listForm.code} onChange={(e) => updateListField("code", e.target.value)} required />
          </label>
          <label>
            Cliente / empresa enlazada
            <select value={listForm.linked_party} onChange={(e) => updateListField("linked_party", e.target.value)}>
              <option value="">Lista general del centro</option>
              {availablePartiesForForm.map((party) => (
                <option key={party.id} value={party.id}>
                  {partyLabel(party)}
                </option>
              ))}
            </select>
            {selectedListPartyConflict && (
              <div style={{ fontSize: "0.75rem", color: "var(--danger)", marginTop: 4 }}>
                Ese cliente ya tiene una lista: {selectedListPartyConflict.code} · {selectedListPartyConflict.name}
              </div>
            )}
          </label>
          <label>
            Centro
            <select value={listForm.collection_center} onChange={(e) => updateListField("collection_center", e.target.value)} required>
              <option value="">Seleccionar</option>
              {centers.map((center) => (
                <option key={center.id} value={center.id}>
                  {center.code} · {center.name} · {center.kind === "smelter" ? "Fundidora" : center.kind === "destination" ? "Destino" : "Acopio"}
                </option>
              ))}
            </select>
          </label>
          <label>
            Moneda
            <input value={listForm.currency} onChange={(e) => updateListField("currency", e.target.value)} placeholder="MXN" />
          </label>
          <label>
            Vigencia desde
            <input type="date" value={listForm.valid_from} onChange={(e) => updateListField("valid_from", e.target.value)} required />
          </label>
          <label>
            Vigencia hasta
            <input type="date" value={listForm.valid_to} onChange={(e) => updateListField("valid_to", e.target.value)} />
          </label>
          <label>
            Activa
            <div className="checkbox-field">
              <input
                type="checkbox"
                checked={listForm.is_active}
                onChange={(e) => updateListField("is_active", e.target.checked)}
              />
              <span>{listForm.is_active ? "Activa" : "Inactiva"}</span>
            </div>
          </label>
          <div className="full-width-form-field" style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button type="submit" disabled={!canManagePriceLists || !!selectedListPartyConflict}>
              {selectedList ? "Actualizar" : "Crear"} lista
            </button>
            <button type="button" className="ghost-button" onClick={startNewList}>
              Limpiar
            </button>
            {selectedList ? (
              <button type="button" className="ghost-button" onClick={removeList} disabled={!canManagePriceLists}>
                Eliminar
              </button>
            ) : null}
          </div>
        </form>
      </section>

        <section className="metric-panel" style={{ marginBottom: 16 }}>
          <div className="section-header">
            <div>
              <h3 style={{ margin: 0 }}>Duplicar lista seleccionada</h3>
              <div className="muted" style={{ marginTop: 4 }}>
                Copia los precios de la lista actual y asígnalos a otra persona o empresa.
              </div>
            </div>
          </div>
          <div className="inline-form compact-form price-list-form" style={{ marginTop: 8 }}>
            <label>
              Origen
              <input value={selectedList ? selectedListDisplayName : "Selecciona una lista"} disabled />
            </label>
            <label>
              Persona / empresa destino
              <select value={duplicatePartyId} onChange={(e) => setDuplicatePartyId(e.target.value)} disabled={!selectedList}>
                <option value="">Seleccionar</option>
                {availablePartiesForDuplicate.map((party) => (
                  <option key={party.id} value={party.id}>
                    {partyLabel(party)}
                  </option>
                ))}
              </select>
              {duplicatePartyConflict && (
                <div style={{ fontSize: "0.75rem", color: "var(--danger)", marginTop: 4 }}>
                  Ese cliente ya tiene una lista: {duplicatePartyConflict.code} · {duplicatePartyConflict.name}
                </div>
              )}
            </label>
            <label>
              Código nuevo
              <input value={duplicateCode} onChange={(e) => setDuplicateCode(e.target.value)} placeholder="Auto si se deja vacío" disabled={!selectedList} />
            </label>
            <div className="full-width-form-field" style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button type="button" onClick={handleDuplicateList} disabled={!canManagePriceLists || !selectedList || !duplicatePartyId || !!duplicatePartyConflict}>
                Duplicar lista
              </button>
            </div>
            <div className="info-banner full-width-form-field" style={{ marginTop: 6 }}>
              La copia incluirá todos los materiales configurados en la lista original.
            </div>
          </div>
        </section>



        <div className="grid" style={{ gridTemplateColumns: "1.35fr 0.95fr", gap: 18, alignItems: "start" }}>
          <section className="metric-panel">
            <h3 style={{ marginTop: 0 }}>Precios de la lista seleccionada</h3>
            <div className="muted" style={{ marginBottom: 12 }}>
              {selectedList ? `${selectedListDisplayName} · ${selectedListPartyLabel}` : "Selecciona una lista para ver o editar sus precios."}
            </div>
            {selectedList && (
              <div className="info-banner" style={{ marginBottom: 12, display: "grid", gap: 6 }}>
                <strong>{selectedListDisplayName}</strong>
                <div className="muted" style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                  <span>{selectedListPartyLabel}</span>
                  <span>{selectedListItemCount} materiales</span>
                  <span>{selectedListActiveItemCount} activos</span>
                </div>
              </div>
            )}
            <table className="table">
              <thead>
                <tr>
                  <th>Material</th>
                  <th>Precio unitario</th>
                  <th>Activa</th>
                </tr>
              </thead>
              <tbody>
              {selectedPriceListItems.map((item) => (
                  <tr
                    key={item.id}
                    onClick={() => setSelectedItemId(item.id)}
                    style={{ cursor: "pointer", background: item.id === selectedItemId ? "rgba(124, 58, 237, 0.12)" : undefined }}
                  >
                    <td>{item.material_name ?? materialById[item.material]?.name ?? item.material}</td>
                    <td>{item.unit_price}</td>
                    <td>{item.is_active ? "Sí" : "No"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
          
        <section className="metric-panel" style={{ marginBottom: 18 }}>
          <div className="section-header">
            <div>
              <h3 style={{ margin: 0 }}>Partida de precio</h3>
              <div className="muted" style={{ marginTop: 4 }}>
                Selecciona una lista y asigna un precio unitario al material.
              </div>
            </div>
          </div>
          <form ref={itemFormRef} className="inline-form compact-form price-item-form" onSubmit={handleItemSubmit}>
            <label>
              Lista
              <select value={itemForm.price_list || selectedListId} onChange={(e) => updateItemField("price_list", e.target.value)} required>
                <option value="">Seleccionar</option>
                {priceLists.map((priceList) => (
                  <option key={priceList.id} value={priceList.id}>
                    {priceList.code} · {partyLabel(partyById[priceList.linked_party ?? ""])}
                  </option>
                ))}
              </select>
            </label>
          <label>
            Material
            <div className="stack-field">
              <input
                value={materialSearch}
                onChange={(e) => setMaterialSearch(e.target.value)}
                placeholder="Buscar material..."
              />
              <select value={itemForm.material} onChange={(e) => updateItemField("material", e.target.value)} required>
                <option value="">Seleccionar</option>
                {filteredMaterials.map((material) => (
                  <option key={material.id} value={material.id}>
                    {materialLabel(material)}
                  </option>
                ))}
              </select>
            </div>
            {selectedItemAlreadyExists && (
              <div style={{ fontSize: "0.75rem", color: "var(--danger)", marginTop: 4 }}>
                Ese material ya existe en esta lista. Si quieres cambiar su precio, selecciónalo en la tabla inferior.
              </div>
            )}
            {!filteredMaterials.length && (
              <div style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: 4 }}>
                No hay materiales disponibles para agregar en esta lista.
              </div>
            )}
          </label>
            <label>
              Precio unitario
              <input value={itemForm.unit_price} onChange={(e) => updateItemField("unit_price", e.target.value)} placeholder="8.500" required />
            </label>
            <label>
              Activa
              <div className="checkbox-field">
                <input
                  type="checkbox"
                  checked={itemForm.is_active}
                  onChange={(e) => updateItemField("is_active", e.target.checked)}
                />
                <span>{itemForm.is_active ? "Activa" : "Inactiva"}</span>
              </div>
            </label>
            <div className="full-width-form-field" style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button type="submit" disabled={!canManagePriceLists || !canSubmitItem}>
              {selectedItem ? "Actualizar" : "Crear"} partida
            </button>
            <button type="button" className="ghost-button" onClick={startNewItem}>
              Limpiar
            </button>
              {selectedItem ? (
                <button type="button" className="ghost-button" onClick={removeItem} disabled={!canManagePriceLists}>
                  Eliminar
                </button>
              ) : null}
            </div>
          </form>
        </section>
      </div>
    </Page>
  );
}
