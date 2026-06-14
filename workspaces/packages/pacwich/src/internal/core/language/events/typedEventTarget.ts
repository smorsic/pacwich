export type TypedEvent<
  TypeName extends string = string,
  ExtraProperties extends object = object,
> = Event & {
  type: TypeName;
} & ExtraProperties;

export const TypedEvent = Event as unknown as {
  prototype: TypedEvent;
  new <TypeName extends string = string>(
    type: TypeName,
    options?: EventInit,
  ): TypedEvent<TypeName>;
};

type ExtraProperties<E> =
  E extends TypedEvent<string, infer ExtraProperties>
    ? Omit<ExtraProperties, "type">
    : undefined;

export const createTypedEventFactory =
  <E extends TypedEvent = TypedEvent>(type: E["type"]) =>
  (properties: ExtraProperties<E>, options?: EventInit) => {
    const event = new TypedEvent(type, options) as E;
    for (const key in properties) {
      (event as Record<keyof ExtraProperties<E>, unknown>)[key] =
        properties[key];
    }
    return event;
  };

export type EventConfig = { [key: string]: TypedEvent };

type EventFromName<
  E extends keyof Config,
  Config extends EventConfig,
> = Config[E];

export interface TypedEventTarget<Config extends EventConfig = EventConfig> {
  addEventListener<EventName extends keyof Config>(
    event: EventName,
    listener: (event: EventFromName<EventName, Config>) => unknown,
  ): void;

  removeEventListener<EventName extends keyof Config>(
    event: EventName,
    listener: (event: EventFromName<EventName, Config>) => unknown,
  ): void;

  dispatchEvent<EventName extends keyof Config>(
    event: EventFromName<EventName, Config>,
  ): boolean;
}

/**
 * An EventTarget with typing for specific events.
 */
export const TypedEventTarget = EventTarget as unknown as {
  prototype: TypedEventTarget;
  new <Config extends EventConfig = EventConfig>(): TypedEventTarget<Config>;
};
