export interface ComponentNode {
  id: string;
  selector: string;
  file: string;
  inputs: string[];
  outputs: string[];
  children: ComponentNode[];
}

export interface RouteInfo {
  path: string;
  component?: string;
  hasChildren: boolean;
  guards?: string[];
}

export type SignalNodeKind =
  | 'signal'
  | 'computed'
  | 'linkedSignal'
  | 'effect'
  | 'template'
  | 'afterRenderEffectPhase'
  | 'childSignalProp'
  | 'unknown';

export interface SignalGraphNode {
  id: string;
  kind: SignalNodeKind;
  label?: string;
  epoch: number;
  value?: unknown;
  watched: boolean;
}

export interface SignalGraphEdge {
  consumer: number;
  producer: number;
}

export interface SignalGraph {
  nodes: SignalGraphNode[];
  edges: SignalGraphEdge[];
  componentSelector?: string;
}

export interface InjectorInfo {
  id: string;
  type: 'element' | 'environment' | 'null';
  name: string;
  providerCount: number;
}

export interface ProviderInfo {
  token: string;
  type: 'class' | 'value' | 'factory' | 'existing' | 'unknown';
  isViewProvider: boolean;
}

export interface InjectorTreeNode {
  injector: InjectorInfo;
  providers: ProviderInfo[];
  children: InjectorTreeNode[];
}

declare module 'devframe' {
  interface DevframeRpcSharedStates {
    'ng-devtools:component-tree': {
      nodes: ComponentNode[];
      selectedId: string | null;
      highlightedId: string | null;
    };
    'ng-devtools:routes': {
      routes: RouteInfo[];
      activeRoute: string | null;
    };
    'ng-devtools:signal-graph': {
      graph: SignalGraph | null;
      selectedNodeId: string | null;
    };
    'ng-devtools:injector-tree': {
      roots: InjectorTreeNode[];
      selectedInjectorId: string | null;
    };
  }
}
