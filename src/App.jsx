import "./App.css";
import OrderSearch from "./components/OrderSearch";
import { useFrontContext } from "./providers/frontContext";
import ReactGA from "react-ga4";

ReactGA.initialize("G-9FCBZSPY3M");

function App() {
  const context = useFrontContext();

  if (!context)
    return (
      <div className="App">
        <p>Waiting to connect to the Front context.</p>
      </div>
    );

  switch (context.type) {
    case "noConversation":
      return (
        <div className="App">
          <p>
            No conversation selected. Select a conversation to use this plugin.
          </p>
        </div>
      );
    case "singleConversation":
      return (
        <div className="App">
          <OrderSearch />
        </div>
      );
    case "multiConversations":
      return (
        <div className="App">
          <p>
            Multiple conversations selected. Select only one conversation to use
            this plugin.
          </p>
        </div>
      );
    default:
      console.error(`Unsupported context type: ${context.type}`);
      break;
  }
}

export default App;
