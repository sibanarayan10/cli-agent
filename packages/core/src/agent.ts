import { AgentTool, Api, ImageContent, Model, TextContent, ThinkingLevel, Tool, Usage } from "./type";

export class Agent{
private __state:MutableAgentState;
private event:AgentEvent;
private steeringQueue:AgentMessage[];
private followingQueue:AgentMessage[];
async prompt(input:AgentMessage[] | AgentMessage): Promise<AgentMessage[]> ;
async prompt(input:string,imageContent:ImageContent[]): Promise<AgentMessage[]>;
async prompt(input:string|AgentMessage[] |AgentMessage,imageContent:ImageContent,abortSignal:AbortSignal):Promise<AgentMessage[]>{
    return new Promise<Array<AgentMessage>>([]);
};
public transformContext:(messages:AgentMessage[])=>Promise<AgentMessage[]>|AgentMessage[];
public convertToLLM:(messages:AgentMessage[])=>Message[]|Promise<Message[]>;
public beforeToolCall:(context:AgentMessage[])=>BeforeToolCallResult
public afterToolCall:(context:AgentMessage[])=>AfterToolCallResult
private __availableTools:Array<Tool>;
private __disabledTools:Array<Tool>;
public compact:(context:AgentMessage[])=>AgentMessage[];


get state(){ return this.__state };
set state(currState:MutableAgentState){
	this.__state=currState;
}

public addToSteeringQueue(input:AgentMessage){
	this.steeringQueue.push(input);
};
public addToFollowingQueue(input:AgentMessage){
	this.followingQueue.push(input);
};

set availableTools(tools:Tool[]){
	this.__availableTools.concat(tools);
}

set disabledTools(tools:Tool[]){
	this.__disabledTools.concat(tools);
}

get disabledTools(){
	return this.__disabledTools;
}

get availableTools(){
	return this.__availableTools;
}

constructor(){}

}

export type AgentEvent =
	// Agent lifecycle
	| { type: "agent_start" }
	| { type: "agent_end"; messages: AgentMessage[] }
	// Turn lifecycle - a turn is one assistant response + any tool calls/results
	| { type: "turn_start" }
	| { type: "turn_end"; message: AgentMessage; toolResults: ToolResultMessage[] }
	// Message lifecycle - emitted for user, assistant, and toolResult messages
	| { type: "message_start"; message: AgentMessage }
	// Only emitted for assistant messages during streaming
	| { type: "message_update"; message: AgentMessage; assistantMessageEvent: AssistantMessageEvent }
	| { type: "message_end"; message: AgentMessage }
	// Tool execution lifecycle
	| { type: "tool_execution_start"; toolCallId: string; toolName: string; args: any }
	| { type: "tool_execution_update"; toolCallId: string; toolName: string; args: any; partialResult: any }
	| { type: "tool_execution_end"; toolCallId: string; toolName: string; result: any; isError: boolean };

const DEFAULT_MODEL = {
	id: "unknown",
	name: "unknown",
	api: "unknown",
	provider: "unknown",
	baseUrl: "",
	reasoning: false,
	input: [],
	cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
	contextWindow: 0,
	maxTokens: 0,
} satisfies Model<any>;



const createMutableAgentState=(initialState:Omit<AgentState,"isStreaming"|"streamingMessage"|"pendingToolCalls"|"errorMessage"> ):MutableAgentState=>{
	let tools = initialState?.tools?.slice() ?? [];
	let messages = initialState?.messages?.slice() ?? [];

	return {
		systemPrompt: initialState?.systemPrompt ?? "",
		model: initialState?.model ?? DEFAULT_MODEL,
		thinkingLevel: initialState?.thinkingLevel ?? "off",
		get tools() {
			return tools;
		},
		set tools(nextTools: AgentTool<any>[]) {
			tools = nextTools.slice();
		},
		get messages() {
			return messages;
		},
		set messages(nextMessages: AgentMessage[]) {
			messages = nextMessages.slice();
		},
		isStreaming: false,
		streamingMessage: undefined,
		pendingToolCalls: new Set<string>(),
		errorMessage: undefined,
	};
}

/**
 * `system prompt`: Adding the system prompt make the model response in a particular way
 * `model`:The current model getting used in the turn
 * `tools`:These are the tools that are available to the agent,it can be used to perform some actions
 * `errorMessage`: If any error is occuring while getting some output
 */
export interface AgentState{
    systemPrompt:string;
    model:Model<any>;
    thinkingLevel:ThinkingLevel;
    set tools(tools: AgentTool<any>[]);
	get tools(): AgentTool<any>[];
	set messages(messages: AgentMessage[]);
	get messages(): AgentMessage[];
	readonly isStreaming: boolean;
	/** Partial assistant message for the current streamed response, if any. */
	readonly streamingMessage?: AgentMessage;
	/** Tool call ids currently executing. */
	readonly pendingToolCalls: ReadonlySet<string>;
	/** Error message from the most recent failed or aborted assistant turn, if any. */
	readonly errorMessage?: string;
}

export type MutableAgentState=Omit<AgentState,"isStreaming"|"streamingMessage"|"pendingToolCalls"|"errorMessage"> & {
    isStreaming:boolean,
    streamingMessage?: AgentMessage;
	pendingToolCalls: Set<string>;
	errorMessage?: string;
} 

export type AgentMessage = Message
export type Message = UserMessage | AssistantMessage | ToolResultMessage;

export interface UserMessage {
	role: "user";
	content: string | (TextContent | ImageContent)[];
	timestamp: number; // Unix timestamp in milliseconds
}

export interface ToolResultMessage<TDetails = any> {
	role: "toolResult";
	toolCallId: string;
	toolName: string;
	content: (TextContent | ImageContent)[]; // Supports text and images
	details?: TDetails;
	/** Usage from the tool execution itself, if available. Not part of main LLM context accounting. */
	usage?: Usage;
	/**
	 * Names from `Context.tools` that became available after this result.
	 * Providers with native deferred tool loading use this as the load point;
	 * other providers ignore it and use `Context.tools` normally.
	 */
	addedToolNames?: string[];
	isError: boolean;
	timestamp: number; // Unix timestamp in milliseconds
}

export interface AssistantMessage {
	role: "assistant";
	content: (TextContent | ThinkingContent | ToolCall)[];
	api: Api;
	provider: ProviderId;
	model: string;
	responseModel?: string; // Concrete `chunk.model` when different from the requested `model` (e.g. OpenRouter `auto` -> `anthropic/...`)
	responseId?: string; // Provider-specific response/message identifier when the upstream API exposes one
	diagnostics?: AssistantMessageDiagnostic[]; // Redacted provider/runtime diagnostics for failures and recoveries.
	usage: Usage;
	stopReason: StopReason;
	deferred?: DeferredHandle;
	errorMessage?: string;
	rawStopReason?: string;
	/**
	 * Provider indication of whether the model explicitly ended its turn.
	 * Preserved for debugging and does not currently affect agent control flow.
	 */
	endTurn?: boolean;
	timestamp: number; // Unix timestamp in milliseconds
}
export interface ToolCall {
	type: "toolCall";
	id: string;
	name: string;
	arguments: Record<string, any>;
	thoughtSignature?: string; // Google-specific: opaque signature for reusing thought context
	/** OpenAI Responses namespace for calls to dynamically loaded or namespaced tools. */
	namespace?: string;
}

export type StopReason = "pending" | "stop" | "length" | "toolUse" | "error" | "aborted" | "deferred";












/**
 * 
 * what are the tables that are required
 * user
 * - id
 * - name
 * - email
 * - imageUrl
 * - timeStamp
 * - recordStatus
 * 
 * chatSession
 * - Id
 * - userId
 * - timeStamp
 * - title
 * 
 * conversation
 * - Id
 * - modelId
 * - userId
 * - request
 * - response
 * - toolCalls
 * - IsForbidden 
 * - timeStamp
 * - responseTime
 * - thinkingLevel
 * Model
 * - name
 * - provider
 * - timeStamp
 * - thinkingLevel
 * - 
 * 
 */


//
