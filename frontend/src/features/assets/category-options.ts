/**
 * Options of the category filter: the active categories, plus the selected one when it is
 * inactive or unknown, so a filter from a link or an old bookmark explains the list it shows.
 */
export function categoryOptions(
  all: { id: string; name: string; isActive: boolean }[],
  selectedId: string,
): { value: string; label: string }[] {
  const options = all.filter((c) => c.isActive).map((c) => ({ value: c.id, label: c.name }));
  if (!selectedId || options.some((o) => o.value === selectedId)) return options;
  const inactive = all.find((c) => c.id === selectedId);
  return [...options, { value: selectedId, label: inactive ? `${inactive.name} (nonaktif)` : 'Kategori tidak dikenal' }];
}
