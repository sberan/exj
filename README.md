<pre>
EXJ(1)

exj

<b>NAME</b>
       exj - node.js standard input processor

<b>SYNOPSIS</b>
       <em>exj</em> [<em>options</em>] <em>'fn'</em>

<b>DESCRIPTION</b>
       <em>Exj</em> executes the given <em>fn</em> upon the standard input. <em>Fn</em> is expected to be a
       javascript function literal. 

       The result of <em>fn</em> execution is printed to standard output. If the result type of
       <em>fn</em> is a <em>string</em>, The result is printed directly to standard output.
      
       Any other result type is converted to JSON using <em>JSON.stringify</em> and 
       printed to standard output.

<b>OPTIONS</b>
       <b>-j</b>, <b>--json</b>
              Treat the input text as JSON. Input text will be converted to JavaScript objects 
              using <em>JSON.parse()</em>.

       <b>-l</b>, <b>--line</b>
              Process each line of input separately. For each line of standard input, <em>'fn'</em> 
              will be invoked for each line encountered, and the result will be written to 
              standard output.

<b>EXAMPLES</b>

       ls | exj -l 'x => x.toUpperCase()'
              Print the contents of the current directory in uppercase

       curl https://jsonplaceholder.typicode.com/photos | exj -j 'res => res.map(({ title, thumbnailUrl }) => `${title} - ${thumbnailUrl}`).join('\n')'
              Fetch and process a JSON payload of album artwork

<b>SEE ALSO</b>
       <b>awk</b>(1), <b>jq</b>(1)

</pre>