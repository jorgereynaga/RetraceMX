export function normalizeSearchValue(value: string | number | null | undefined) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function matchesSearch(values: Array<string | number | boolean | null | undefined>, query: string) {
  const normalizedQuery = normalizeSearchValue(query);
  if (!normalizedQuery) return true;
  return values.some((value) => normalizeSearchValue(String(value)).includes(normalizedQuery));
}

export function paginate<T>(items: T[], page: number, pageSize: number) {
  const safePageSize = Math.max(1, pageSize);
  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / safePageSize));
  const pageNumber = Math.min(Math.max(1, page), totalPages);
  const startIndex = (pageNumber - 1) * safePageSize;

  return {
    items: items.slice(startIndex, startIndex + safePageSize),
    page: pageNumber,
    pageSize: safePageSize,
    totalItems,
    totalPages,
    from: totalItems === 0 ? 0 : startIndex + 1,
    to: Math.min(startIndex + safePageSize, totalItems),
  };
}

export function sortByValue<T>(
  items: T[],
  accessor: (item: T) => string | number | boolean | null | undefined,
  direction: "asc" | "desc" = "asc",
) {
  const multiplier = direction === "asc" ? 1 : -1;
  return [...items].sort((left, right) => {
    const leftValue = accessor(left);
    const rightValue = accessor(right);
    const leftNumber = Number(leftValue);
    const rightNumber = Number(rightValue);

    const leftIsNumber = leftValue !== null && leftValue !== undefined && leftValue !== "" && Number.isFinite(leftNumber);
    const rightIsNumber = rightValue !== null && rightValue !== undefined && rightValue !== "" && Number.isFinite(rightNumber);

    if (leftIsNumber && rightIsNumber) {
      return (leftNumber - rightNumber) * multiplier;
    }

    const leftText = normalizeSearchValue(String(leftValue));
    const rightText = normalizeSearchValue(String(rightValue));
    return leftText.localeCompare(rightText) * multiplier;
  });
}
