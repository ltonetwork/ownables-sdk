interface SelectFileProps {
  accept?: string,
  multiple?: boolean,
}

export default async function selectFile(props: SelectFileProps = {}): Promise<FileList> {
  return new Promise((resolve, reject) => {
    let input = document.createElement("input");
    input.type = "file";
    input.accept = props.accept || '';
    input.multiple = !!props.multiple;

    input.onchange = () => {
      resolve(input.files || new FileList());
    }
    input.onerror = () => reject("Error selecting files");
    input.click();
  });
}
