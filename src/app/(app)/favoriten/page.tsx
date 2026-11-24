"use client";

import { FavoriteList } from "@/components/study/favorite-list";
import { LoadError, Loading } from "@/components/study/loading";
import { Container, PageHeader } from "@/components/study/ui";
import { useData } from "@/lib/client/use-data";
import { store } from "@/lib/data";

export default function FavoritesPage() {
  const { data, error } = useData(() => store.listFavorites(), []);
  return (
    <Container>
      <PageHeader eyebrow="Gesammelt" title="Favoriten">
        Deine gespeicherten Antworten und Kommentare.
      </PageHeader>
      {error ? <LoadError error={error} /> : !data ? <Loading /> : <FavoriteList key={data.length} initial={data} />}
    </Container>
  );
}
