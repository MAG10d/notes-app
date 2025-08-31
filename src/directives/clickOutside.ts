import { onCleanup } from "solid-js";

// This declare is to make TypeScript recognize the use:clickOutside in JSX
// Otherwise TypeScript will report an error saying this property does not exist
declare module "solid-js" {
  namespace JSX {
    interface Directives {
      clickOutside: () => void;
    }
  }
}

// This is the core function of the directive
export function clickOutside(el: HTMLElement, accessor: () => () => void) {
  // `el` is the DOM element the directive is attached to
  // `accessor` is a getter function that returns the function you passed in JSX, such as () => setDropdownOpen(false)
  const onClick = (e: MouseEvent) => {
    // Core logic: if the target of the click (e.target) is not inside the element (el)
    if (!el.contains(e.target as Node)) {
      // Execute the function you passed in
      accessor()();
    }
  };

  // Mount the event listener on the document
  document.body.addEventListener("click", onClick);

  // SolidJS's magic: onCleanup will be executed automatically when the element is destroyed
  // This ensures that the event listener will be removed, preventing memory leaks
  onCleanup(() => {
    document.body.removeEventListener("click", onClick);
  });
}