# myCDrecords - Frontend

Uma plataforma React para gerenciar sua coleção de CDs e discos (o "Letterboxd para Música").

## Características

- **Navbar com logo myCDrecords** em verde neon com fontes personalizadas
- **Hero Search Section** com fundo desfocado em tons de verde/roxo
- **Carousels de álbuns** com design de posters (aspect-square, border hover effect)
- **Design System Dark Mode** com paleta: background (#14181c), surface (#191e25), accent (#00e054)
- **Responsive** com Tailwind CSS v3

## Tecnologias

- React 19 + TypeScript
- Vite
- Tailwind CSS v3
- React Router v7
- Axios (com credentials para HTTP-only cookies)
- Lucide React (ícones)

## Instalação

```bash
cd frontend
npm install
npm run dev
```

A aplicação estará disponível em `http://localhost:5173`

## Estrutura do Projeto

```
src/
├── components/
│   ├── Navbar.tsx          # Navbar com busca e autenticação
│   └── AlbumCarousel.tsx   # Carousel reutilizável de álbuns
├── pages/
│   └── Home.tsx            # Homepage com hero search e carousels
├── lib/
│   └── apiClient.ts        # Cliente Axios configurado
├── App.tsx                 # Router principal
├── main.tsx                # Entry point
└── index.css               # Estilos globais + Tailwind

public/
└── favicon.svg
```

## API Integration

O frontend está configurado para se comunicar com o backend Express em `http://localhost:3000/api`.

### Axios Client
- Já configurado com `withCredentials: true` para HTTP-only cookies
- Localizado em `src/lib/apiClient.ts`

### Endpoints Esperados (do backend):

- `POST /api/auth/login` - Login
- `POST /api/auth/register` - Registro
- `POST /api/auth/logout` - Logout
- `GET /api/albuns/buscar?nome=...` - Buscar álbuns
- `GET /api/artistas/buscar?nome=...` - Buscar artistas

## Próximos Passos

- [ ] Integrar autenticação (login/register pages)
- [ ] Página de detalhes do álbum
- [ ] Integração com API de busca
- [ ] Sistema de avaliações e reviews
- [ ] Página de perfil do usuário
- [ ] Sistema de favoritos/listas

## Design Notes

Seguindo o design system especificado:

- **Cores**: Verde neon (#00e054) para accent, roxo (#a855f7) para features especiais como "Lists"
- **Tipografia**: Poppins para corpo, Pacifico para logo
- **Hover Effects**: Albums ganham borda verde e overlay escuro ao hover
- **Carousels**: Scroll horizontal com botões de navegação (appear on hover)

## Build para Produção

```bash
npm run build
npm run preview
```
