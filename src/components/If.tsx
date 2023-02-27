import React from "react";

export default function If(props: {condition: boolean, children: any}): JSX.Element {
    return props.condition ? <>{props.children}</> : <></>
}
