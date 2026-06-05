/**
 * Project-specific functions: CRUD, metadata, repository, member, and MCP config.
 * Uses the generic factories from meta-crud.ts.
 */
import type { ProjectMeta, Repository, ProjectMember } from "../types";
import {
  readMetaFromDb,
  writeMetaToDb,
  createEntityCrud,
  createRepositoryCrud,
  createMemberCrud,
  createMcpConfigCrud,
} from "./meta-crud";
import type { EntityStrategy } from "./meta-crud";

// ────────────────────────────────────────────────────────────
// Project strategy
// ────────────────────────────────────────────────────────────

const PROJECT_STRATEGY: EntityStrategy = {
  entityName: "Project",
  entityDir: "projects",
  entityType: "project",
  metaFileName: ".project.json",
  defaultNamePrefix: "Project",
  createDocsDir: true,
  readMeta(dirSegments) {
    const entityId = dirSegments[dirSegments.length - 1];
    return readMetaFromDb(entityId, "project");
  },
  writeMeta(meta, _dirSegments) {
    writeMetaToDb(meta, "project");
  },
};

// ────────────────────────────────────────────────────────────
// Entity CRUD
// ────────────────────────────────────────────────────────────

const projectEntityCrud = createEntityCrud(PROJECT_STRATEGY);

export const listProjects = projectEntityCrud.list;
export const createProject = projectEntityCrud.create;
export const deleteProject = projectEntityCrud.remove;

// ────────────────────────────────────────────────────────────
// Metadata read/write
// ────────────────────────────────────────────────────────────

export function readProjectMeta(dirSegments: string[]): ProjectMeta | null {
  return PROJECT_STRATEGY.readMeta(dirSegments);
}

export function writeProjectMeta(meta: ProjectMeta, dirSegments: string[]): void {
  PROJECT_STRATEGY.writeMeta(meta, dirSegments);
}

// ────────────────────────────────────────────────────────────
// Repository CRUD
// ────────────────────────────────────────────────────────────

const projectRepoCrud = createRepositoryCrud(PROJECT_STRATEGY);

export const addRepository: (dirSegments: string[], repository: Repository) => Repository[] = projectRepoCrud.add;
export const removeRepository: (dirSegments: string[], repoId: string) => void = projectRepoCrud.remove;
export const updateRepository: (dirSegments: string[], repoId: string, updates: Partial<Omit<Repository, "id">>) => Repository | null = projectRepoCrud.update;

// ────────────────────────────────────────────────────────────
// Member CRUD
// ────────────────────────────────────────────────────────────

const projectMemberCrud = createMemberCrud(PROJECT_STRATEGY);

export const addMember: (dirSegments: string[], member: ProjectMember) => ProjectMember[] = projectMemberCrud.add;
export const removeMember: (dirSegments: string[], memberId: string) => void = projectMemberCrud.remove;
export const updateMember: (dirSegments: string[], memberId: string, updates: Partial<Omit<ProjectMember, "id">>) => ProjectMember | null = projectMemberCrud.update;

// ────────────────────────────────────────────────────────────
// MCP Config
// ────────────────────────────────────────────────────────────

const projectMcpCrud = createMcpConfigCrud();

export const readProjectMcpConfig = projectMcpCrud.read;
export const writeProjectMcpConfig = projectMcpCrud.write;
