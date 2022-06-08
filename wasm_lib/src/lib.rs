pub mod common {
    use std::fmt;
    use schemars::JsonSchema;
    use serde::{Deserialize, Serialize};
    
    #[repr(C)]
    pub struct Msg {
        pub count: i32,
        //pub description: String,
    }

    impl Msg {
        pub fn inc(&mut self, amount: i32) {
            self.count += amount;
        }

        pub fn describe(self) -> String {
            //format!("{} {}", self.count, self.description)
            format!("{}", self.count)
        }
    }
}