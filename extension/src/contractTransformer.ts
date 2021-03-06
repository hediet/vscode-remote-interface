import {
	OneSideContract,
	ContractObject,
	Contract,
	AsOneSideContract,
	AnyRequestContract,
	JSONObject,
	RuntimeJsonType,
	NotificationType,
	RequestType,
} from "@hediet/typed-json-rpc";
import { string, boolean } from "io-ts";

class ExternParam<TParamName extends string, TType> {
	constructor(
		public readonly paramName: TParamName,
		public readonly type: RuntimeJsonType<TType>,
		public readonly defaultValue: () => TType
	) {}

	public get TType(): TType {
		throw new Error("Don't call this method. It is meant for typing only.");
	}
	public get TExtra(): { [TKey in TParamName]: TType } {
		throw new Error("Don't call this method. It is meant for typing only.");
	}

	public set(target: JSONObject, value: TType): void {
		target[this.paramName] = this.type.encode(value);
	}

	public get(target: JSONObject): TType {
		if (!(this.paramName in target)) {
			return this.defaultValue();
		}
		const val = target[this.paramName];
		const r = this.type.decode(val);
		if (r.isLeft()) {
			throw new Error(r.value.map(e => e.message).join(", "));
		} else {
			return r.value;
		}
	}
}

function paramDef<TParamName extends string, TType>(def: {
	paramName: TParamName;
	type: RuntimeJsonType<TType>;
	defaultValue?: TType;
}): ExternParam<TParamName, TType> {
	return new ExternParam(
		def.paramName,
		def.type,
		"defaultValue" in def
			? () => def.defaultValue!
			: () => {
					throw new Error("No value");
			  }
	);
}

export const sourceClientIdParam = paramDef({
	paramName: "$sourceClientId",
	type: string,
});

export const serverToServerParam = paramDef({
	paramName: "$serverToServer",
	type: boolean,
	defaultValue: false,
});

type ExtendServerContract<
	TRequestMap extends OneSideContract
> = AsOneSideContract<
	{
		[TRequest in keyof TRequestMap]: TRequestMap[TRequest] extends AnyRequestContract
			? MapRequest<TRequestMap[TRequest]>
			: NotificationType<
					TRequestMap[TRequest]["paramType"]["_A"] &
						typeof sourceClientIdParam.TExtra &
						typeof serverToServerParam.TExtra
			  >
	}
>;

type MapRequest<TRequest extends AnyRequestContract> = RequestType<
	TRequest["paramType"]["_A"] & {
		$sourceClientId: string;
	},
	TRequest["resultType"]["_A"],
	TRequest["errorType"]["_A"]
>;

export function dispatched<
	TTags extends string,
	TContractObj extends ContractObject
>(
	contract: Contract<TTags, TContractObj>
): Contract<
	TTags,
	{
		server: ExtendServerContract<TContractObj["server"]>;
		client: TContractObj["client"];
	}
> {
	// TODO implement actual typechecking of $sourceClientId
	return contract as any;
}
