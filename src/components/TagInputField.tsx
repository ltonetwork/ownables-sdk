import React, { useState } from "react";
import { Stack, TextField, Chip } from "@mui/material";

interface TagInputFieldProps {
  onTagsChange: (tags: string[]) => void;
}

const TagInputField = ({ onTagsChange }: TagInputFieldProps) => {
  const [inputValue, setInputValue] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [error, setError] = useState("");

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(event.target.value);
    setError("");
  };

  const handleAddTag = () => {
    if (!inputValue.trim()) {
      setError("Tag cannot be empty.");
      return;
    }
    if (tags.includes(inputValue)) {
      setError("Tag already exists.");
      return;
    }
    const newTags = [...tags, inputValue];
    setTags(newTags);
    onTagsChange(newTags);
    setInputValue("");
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags((prevTags) => prevTags.filter((tag) => tag !== tagToRemove));
  };
  return (
    <Stack direction="column" spacing={1}>
      <TextField
        value={inputValue}
        onChange={handleInputChange}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleAddTag();
          }
        }}
        placeholder="Enter your keywords"
        variant="outlined"
        size="small"
        error={!!error}
        helperText={error}
      />
      <Stack direction="row" spacing={1}>
        {tags.map((tag) => (
          <Chip
            key={tag}
            label={tag}
            onDelete={() => handleRemoveTag(tag)}
            color="primary"
            variant="outlined"
            size="small"
          />
        ))}
      </Stack>
    </Stack>
  );
};

export default TagInputField;
